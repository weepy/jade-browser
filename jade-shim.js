require.module('fs', function(module, exports, require) {
})

if(!Object.keys) {
  Object.keys = function(o) {
    var ret = []
    for(var i in o) ret.push(i)
    return ret
  }
}