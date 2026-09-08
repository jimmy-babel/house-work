import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const workbookPath = process.argv[2] || path.resolve(process.cwd(), '源数据.xlsx')
const sourceSheet = '家务LIST'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，请先配置 .env.local。')
}

if (!fs.existsSync(workbookPath)) {
  throw new Error(`未找到源数据文件：${workbookPath}`)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function splitFrequency(rawLabel) {
  const normalized = String(rawLabel || '').replace(/\s+/g, ' ').trim()
  const match = normalized.match(/\s*-\s*((?:GL-\d+(?:-\d+)*)|2W|6M|[DWML])\s*$/)
  return {
    rawLabel: normalized,
    name: normalized.replace(/\s*-\s*((?:GL-\d+(?:-\d+)*)|2W|6M|[DWML])\s*$/, '').trim(),
    frequencyCode: match ? match[1] : null,
  }
}

function buildItemsFromSheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  })

  const header = rows[0] || []
  const categories = header.slice(1, -1).map((value) => String(value).trim())
  const items = []

  rows.slice(1).forEach((row) => {
    const sourceRowNo = Number(String(row[0] || '').trim())
    if (!sourceRowNo) return

    categories.forEach((categoryName, categoryIndex) => {
      const cellValue = String(row[categoryIndex + 1] || '').trim()
      if (!cellValue) return

      const parsed = splitFrequency(cellValue)
      items.push({
        source_sheet: sourceSheet,
        category_name: categoryName,
        source_row_no: sourceRowNo,
        name: parsed.name,
        raw_label: parsed.rawLabel,
        frequency_code: parsed.frequencyCode,
        sort_order: sourceRowNo,
        is_active: true,
      })
    })
  })

  return items
}

function toKey(item) {
  return `${item.source_sheet}::${item.category_name}::${item.source_row_no}`
}

async function main() {
  const workbookBuffer = fs.readFileSync(workbookPath)
  const workbook = XLSX.read(workbookBuffer, { type: 'buffer' })
  const worksheet = workbook.Sheets[sourceSheet]

  if (!worksheet) {
    throw new Error(`Excel 中未找到工作表：${sourceSheet}`)
  }

  const incomingItems = buildItemsFromSheet(worksheet)
  const incomingKeys = new Set(incomingItems.map(toKey))

  const { data: existingRows, error: selectError } = await supabase
    .from('chore_catalog')
    .select(
      'id, source_sheet, category_name, source_row_no, name, raw_label, frequency_code, sort_order, is_active'
    )
    .eq('source_sheet', sourceSheet)

  if (selectError) {
    throw selectError
  }

  const existingMap = new Map((existingRows || []).map((item) => [toKey(item), item]))

  let insertedCount = 0
  let updatedCount = 0

  incomingItems.forEach((item) => {
    const existing = existingMap.get(toKey(item))
    if (!existing) {
      insertedCount += 1
      return
    }

    const changed =
      existing.name !== item.name ||
      existing.raw_label !== item.raw_label ||
      existing.frequency_code !== item.frequency_code ||
      existing.sort_order !== item.sort_order ||
      existing.is_active !== item.is_active

    if (changed) {
      updatedCount += 1
    }
  })

  const { error: upsertError } = await supabase
    .from('chore_catalog')
    .upsert(incomingItems, { onConflict: 'source_sheet,category_name,source_row_no' })

  if (upsertError) {
    throw upsertError
  }

  const staleIds = (existingRows || [])
    .filter((item) => item.is_active && !incomingKeys.has(toKey(item)))
    .map((item) => item.id)

  let inactivatedCount = 0
  if (staleIds.length > 0) {
    const { error: inactiveError } = await supabase
      .from('chore_catalog')
      .update({ is_active: false })
      .in('id', staleIds)

    if (inactiveError) {
      throw inactiveError
    }
    inactivatedCount = staleIds.length
  }

  const { error: importLogError } = await supabase.from('source_import_runs').insert({
    source_file_name: path.basename(workbookPath),
    total_items: incomingItems.length,
    inserted_count: insertedCount,
    updated_count: updatedCount,
    inactivated_count: inactivatedCount,
  })

  if (importLogError) {
    throw importLogError
  }

  console.log(
    JSON.stringify(
      {
        sourceFile: path.basename(workbookPath),
        totalItems: incomingItems.length,
        insertedCount,
        updatedCount,
        inactivatedCount,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[sync:source] 导入失败')
  console.error(error)
  process.exitCode = 1
})
