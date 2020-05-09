const fs = require("fs");
fs.promises.readFile("./mock-file/tempBased.xml.bin").then(data => {
  for (let v of data) {
    console.log(v);
  }
})