require("brequire")("jade")
  .search("./lib/**", "./index.js")
  .include_lib()
  .write("./jade.js")
