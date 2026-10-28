#!/usr/bin/env bash
# 非公開の記録置き場（kiroku/ に clone した juice0402/oshi-techo-data）に、data/ と notes/ をコミットして送る。
# 公開のログには、送れたかどうかだけを出す。
set -u
cd kiroku || exit 1
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A data notes
if git diff --cached --quiet; then
  echo "記録の変化なし"
  exit 0
fi
git commit -q -m "$1"
for i in 1 2 3; do
  if git pull -q --rebase origin main > /dev/null 2>&1 && git push -q origin HEAD:main > /dev/null 2>&1; then
    echo "記録置き場に保存しました"
    exit 0
  fi
  sleep 5
done
echo "::error title=記録::記録置き場に保存できませんでした"
exit 1
