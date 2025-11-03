# Git shortcuts
alias gs='git status'
alias ga='git add .'
alias gc='git commit -m'
alias gp='git push'
alias gl='git log --oneline'
alias all='git add . && git commit -m "えいりあすぷっしゅ" && git push'

# Quick commit with custom message
function gall() {
  git add .
  git commit -m "${1:-Update}"
  git push
}