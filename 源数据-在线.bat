@echo off
cd /d "%~dp0"
rem WPS share link ID is verified; local Excel sync remains separate.
set "WPS_FILE_ID=cp2BZF3Loufy"
yarn sync:source:wps %*
