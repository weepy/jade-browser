require("brequire")("jade")
  .search("./lib/**")
  .include_lib()
  .write("./jade.js")
