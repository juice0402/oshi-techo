#!/usr/bin/env bash
# 公開のログに楽天のデータ（商品名・値段など）を出さないための包み。
# コマンドの出力は、非公開の記録置き場（juice0402/oshi-techo-data）のメモ $NOTES にだけ書き、
# 公開のログには「済」か「失敗」だけを出す。終わりのコードはコマンドのまま返す。
set -u
: "${NOTES:?NOTES（メモのファイル）がありません}"
{ echo; echo "### $(date -u +%FT%TZ) ${1:-} ${2:-}"; } >> "$NOTES"
"$@" >> "$NOTES" 2>&1
code=$?
if [ "$code" -eq 0 ]; then
  echo "済"
else
  echo "::error title=失敗::くわしくは非公開の oshi-techo-data の notes/update.log"
fi
exit "$code"
