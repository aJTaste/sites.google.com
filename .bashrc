# Git shortcuts
alias gs='git status'
alias ga='git add .'
alias gc='git commit -m'
alias gp='git push'
alias gl='git log --oneline --graph --decorate'

# All-in-one add+commit+push (message required)
function gall() {
  if [ -z "$1" ]; then
    echo "Usage:  \"commit message\""
    return 1
  fi
  git add .
  git commit -m "$1"
  git push
}

# Create new branch from current branch and set upstream
# Usage: gnb new-branch-name
function gnb() {
  if [ -z "$1" ]; then
    echo "Usage: gnb <branch-name>"
    return 1
  fi

  local BRANCH="$1"

  # Create and switch
  git checkout -b "$BRANCH"

  # Push and set upstream
  git push -u origin "$BRANCH"

  echo "✔ Branch '$BRANCH' created and pushed (tracking branch set)"
}

# Switch & update main quickly
alias gmain='git checkout main && git pull'

# あるコミットの状態に完全に戻したいとき
git reset --hard [コミットID]
# からの
git push --force-with-lease

function gre() {
  if [ -z "$1" ]; then
    echo "Usage: \"commit sha\""
    return 1
  fi
  git reset --hard "$1"
  git push --force-with-lease
}