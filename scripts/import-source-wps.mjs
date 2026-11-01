import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const cliArgs = process.argv.slice(2)
const localWorkbookPath = cliArgs.find((arg) => !arg.startsWith('--')) || path.resolve(process.cwd(), '源数据.xlsx')
const validateOnly = cliArgs.includes('--validate-only')
const databaseSourceSheet = '家务LIST'
const wpsWorksheetName = process.env.WPS_WORKSHEET_NAME || '家务LIST'
const sourceMode = 'wps'
const maxRows = 5000
const maxColumns = 128

function splitFrequency(rawLabel) {
  const normalized = String(rawLabel || '').replace(/\s+/g, ' ').trim()
  const match = normalized.match(/\s*-\s*((?:GL-\d+(?:-\d+)*)|2W|6M|[DWML])\s*$/)
  return {
    rawLabel: normalized,
    name: normalized.replace(/\s*-\s*((?:GL-\d+(?:-\d+)*)|2W|6M|[DWML])\s*$/, '').trim(),
    frequencyCode: match ? match[1] : null,
  }
}

function validateAndBuildItems(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('源表格没有标题行或任务数据，已停止同步以保护现有目录。')
  }

  const header = rows[0].map((value) => String(value ?? '').trim())
  if (header[0] !== '序号/分类') {
    throw new Error(`源表格第一列表头应为“序号/分类”，实际为“${header[0] || '(空)'}”，已停止同步。`)
  }

  const metadataColumnIndex = header.findIndex((value, index) => index > 0 && /D天\s*W周\s*M月\s*GL关联/i.test(value))
  const lastCategoryIndex = metadataColumnIndex >= 0
    ? metadataColumnIndex
    : header.reduce((lastIndex, value, index) => value ? index : lastIndex, 0) + 1
  const categories = header.slice(1, lastCategoryIndex).map((value) => value.trim())
  if (!categories.length || categories.some((category) => !category)) {
    throw new Error('源表格分类标题为空或缺失，已停止同步。')
  }
  if (new Set(categories).size !== categories.length) {
    throw new Error('源表格存在重复分类标题，已停止同步。')
  }

  const items = []
  const seenRows = new Set()
  for (const row of rows.slice(1)) {
    const rowNo = Number(String(row[0] ?? '').trim())
    if (!row[0] && row.slice(1, lastCategoryIndex).every((value) => !String(value ?? '').trim())) continue
    if (!Number.isInteger(rowNo) || rowNo <= 0) {
      throw new Error(`源表格存在无效序号“${row[0] ?? ''}”，已停止同步。`)
    }
    if (seenRows.has(rowNo)) {
      throw new Error(`源表格序号 ${rowNo} 重复，当前导入规则以序号识别任务，已停止同步。`)
    }
    seenRows.add(rowNo)

    categories.forEach((categoryName, categoryIndex) => {
      const cellValue = String(row[categoryIndex + 1] ?? '').trim()
      if (!cellValue) return

      const parsed = splitFrequency(cellValue)
      if (!parsed.name) {
        throw new Error(`源表格第 ${rowNo} 行的“${categoryName}”任务名称为空，已停止同步。`)
      }
      items.push({
        source_sheet: databaseSourceSheet,
        category_name: categoryName,
        source_row_no: rowNo,
        name: parsed.name,
        raw_label: parsed.rawLabel,
        frequency_code: parsed.frequencyCode,
        sort_order: rowNo,
        is_active: true,
      })
    })
  }

  if (!items.length) {
    throw new Error('源表格中没有可导入的任务，已停止同步以保护现有目录。')
  }

  const keys = new Set(items.map((item) => `${item.category_name}::${item.source_row_no}`))
  if (keys.size !== items.length) {
    throw new Error('源表格存在重复的“分类 + 序号”任务，已停止同步。')
  }
  return items
}

function readLocalWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`未找到源数据文件：${filePath}`)
  }
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
  const worksheet = workbook.Sheets[databaseSourceSheet]
  if (!worksheet) {
    throw new Error(`Excel 中未找到工作表：${databaseSourceSheet}`)
  }
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
}

async function wpsRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || (body && body.code !== undefined && body.code !== 0)) {
    const status = body?.code ?? response.status
    const message = body?.msg || response.statusText || '未知错误'
    throw new Error(`WPS 接口请求失败（${status}）：${message}`)
  }
  return body
}

async function getWpsAccessToken() {
  const appId = process.env.WPS_APP_ID
  const appSecret = process.env.WPS_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('缺少 WPS_APP_ID 或 WPS_APP_SECRET，请按 README 配置 WPS 开放平台应用。')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: appId,
    client_secret: appSecret,
  })
  const response = await wpsRequest('https://openapi.wps.cn/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const token = response?.access_token || response?.data?.access_token
  if (!token) throw new Error('WPS 授权接口没有返回 access_token。')
  return token
}

async function readWpsWorksheetRows() {
  const fileId = process.env.WPS_FILE_ID
  if (!fileId) {
    throw new Error('缺少 WPS_FILE_ID（可使用已验证可读的 WPS 分享链接短 ID）。')
  }

  const token = await getWpsAccessToken()
  const authHeaders = { Authorization: `Bearer ${token}` }
  const encodedFileId = encodeURIComponent(fileId)
  const sheetList = await wpsRequest(`https://openapi.wps.cn/v7/sheets/${encodedFileId}/worksheets`, {
    headers: authHeaders,
  })
  const sheets = sheetList?.data?.sheets
  if (!Array.isArray(sheets)) throw new Error('WPS 工作表接口响应缺少 sheets 列表。')
  const matches = sheets.filter((sheet) => sheet.name === wpsWorksheetName)
  if (matches.length !== 1) {
    throw new Error(`在线文档中应有且仅有一个名为“${wpsWorksheetName}”的工作表，当前找到 ${matches.length} 个。`)
  }

  const sheet = matches[0]
  const activeArea = sheet.active_area
  const rowTo = Number(activeArea?.row_to)
  const columnTo = Number(activeArea?.col_to)
  if (!Number.isInteger(rowTo) || !Number.isInteger(columnTo) || rowTo < 1 || columnTo < 1) {
    throw new Error(`在线工作表“${wpsWorksheetName}”为空或没有可读取区域，已停止同步。`)
  }
  const rowCount = rowTo + 1
  const columnCount = columnTo + 1
  if (rowCount > maxRows || columnCount > maxColumns) {
    throw new Error(`在线工作表区域过大（${rowCount} 行 × ${columnCount} 列），超出安全上限，已停止同步。`)
  }

  const query = new URLSearchParams({
    row_from: '0',
    row_to: String(rowCount - 1),
    col_from: '0',
    col_to: String(columnCount - 1),
  })
  const range = await wpsRequest(
    `https://openapi.wps.cn/v7/sheets/${encodedFileId}/worksheets/${encodeURIComponent(sheet.sheet_id)}/range_data?${query}`,
    { headers: authHeaders },
  )
  const cells = range?.data?.range_data
  if (!Array.isArray(cells)) throw new Error('WPS 单元格接口响应缺少 range_data。')

  const rows = Array.from({ length: rowCount }, () => Array(columnCount).fill(''))
  for (const cell of cells) {
    const rowIndex = Number(cell.row_from)
    const columnIndex = Number(cell.col_from)
    if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex) || rowIndex < 0 || columnIndex < 0) continue
    if (rowIndex >= rowCount || columnIndex >= columnCount) continue
    rows[rowIndex][columnIndex] = cell.cell_text ?? cell.original_cell_value ?? ''
  }
  return rows
}

async function importItems(items, sourceFileName) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，请先配置 .env.local。')
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const incomingKeys = new Set(items.map((item) => `${item.source_sheet}::${item.category_name}::${item.source_row_no}`))
  const { data: existingRows, error: selectError } = await supabase
    .from('chore_catalog')
    .select('id, source_sheet, category_name, source_row_no, name, raw_label, frequency_code, sort_order, is_active')
    .eq('source_sheet', databaseSourceSheet)

  if (selectError) throw selectError
  const existingMap = new Map((existingRows || []).map((item) => [
    `${item.source_sheet}::${item.category_name}::${item.source_row_no}`,
    item,
  ]))

  let insertedCount = 0
  let updatedCount = 0
  for (const item of items) {
    const key = `${item.source_sheet}::${item.category_name}::${item.source_row_no}`
    const existing = existingMap.get(key)
    if (!existing) {
      insertedCount += 1
      continue
    }
    const changed = existing.name !== item.name ||
      existing.raw_label !== item.raw_label ||
      existing.frequency_code !== item.frequency_code ||
      existing.sort_order !== item.sort_order ||
      existing.is_active !== item.is_active
    if (changed) updatedCount += 1
  }

  const { error: upsertError } = await supabase
    .from('chore_catalog')
    .upsert(items, { onConflict: 'source_sheet,category_name,source_row_no' })
  if (upsertError) throw upsertError

  const staleIds = (existingRows || [])
    .filter((item) => item.is_active && !incomingKeys.has(`${item.source_sheet}::${item.category_name}::${item.source_row_no}`))
    .map((item) => item.id)
  let inactivatedCount = 0
  if (staleIds.length) {
    const { error: inactiveError } = await supabase
      .from('chore_catalog')
      .update({ is_active: false })
      .in('id', staleIds)
    if (inactiveError) throw inactiveError
    inactivatedCount = staleIds.length
  }

  const { error: importLogError } = await supabase.from('source_import_runs').insert({
    source_file_name: sourceFileName,
    total_items: items.length,
    inserted_count: insertedCount,
    updated_count: updatedCount,
    inactivated_count: inactivatedCount,
  })
  if (importLogError) throw importLogError

  console.log(JSON.stringify({ sourceFile: sourceFileName, totalItems: items.length, insertedCount, updatedCount, inactivatedCount }, null, 2))
}

async function main() {
  let rows
  let sourceFileName
  if (sourceMode === 'wps') {
    rows = await readWpsWorksheetRows()
    sourceFileName = `金山文档-${wpsWorksheetName}`
  } else if (sourceMode === 'local') {
    rows = readLocalWorkbook(localWorkbookPath)
    sourceFileName = path.basename(localWorkbookPath)
  } else {
    throw new Error(`不支持 SOURCE_DATA_MODE=${sourceMode}，请使用 wps 或 local。`)
  }

  const items = validateAndBuildItems(rows)
  if (validateOnly) {
    console.log(JSON.stringify({ sourceFile: sourceFileName, valid: true, totalItems: items.length, mode: sourceMode }, null, 2))
    return
  }
  await importItems(items, sourceFileName)
}

main().catch((error) => {
  console.error('[sync:source] 导入失败')
  console.error(error)
  process.exitCode = 1
})
