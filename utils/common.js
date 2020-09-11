const prettyBalance = (balance, decimals = 18, len = 8) => {
  const diff = balance.toString().length - (10 ** decimals).toString().length
  const fixedPoint = Math.max(1, Math.min(len, len - diff))
  const finalBalance = (balance / (10 ** decimals)).toFixed(fixedPoint).toLocaleString()
  const [head, tail] = finalBalance.split('.')
  const formattedHead = head.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${formattedHead}.${tail}`
}

const groupBy = function (xs, key) {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x)
    return rv
  }, {})
}

const logBase = (n, base) => {
  return Math.log(n) / Math.log(base)
}

module.exports = {
  prettyBalance,
  groupBy,
  logBase
} 