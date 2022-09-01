import { readFile, writeFile } from 'fs';
const ytdlFix = `const ytdl = async (link, options) => {
  const stream = createStream(options);
  return new Promise(async (r, j) => {
    let rejected = false;
    let error;
    let info = await ytdl.getInfo(link, options).catch((err) => { rejected = true; error = err; });
    if (rejected) return void j(error);
    downloadFromInfoCallback(stream, info, options);
    r(stream);
  });
}
module.exports = ytdl;`;
const ytdlSigFix = `const end = body.indexOf('.join("")};', ndx);
const subBody = body.slice(ndx, end);
const functionBody = \`\${subBody}.join("")};\${functionName}(ncode);\`;`

readFile("./node_modules/ytdl-core/lib/index.js", { encoding: "utf8" }, function (_err, data) {
    var formatted = data.replace(/const ytdl = \((.|\n)*ytdl;/gm, ytdlFix);
    writeFile("./node_modules/ytdl-core/lib/index.js", formatted, 'utf8', function (err) {
        if (err) return console.log(err);
    });
});

readFile("./node_modules/ytdl-core/lib/sig.js", {encoding: "utf8" }, function (_err, data) {
  var formatted = data.replace(/const subBody(.+\n){2}.*Body\);/, ytdlSigFix);
  writeFile("./node_modules/ytdl-core/lib/sig.js", formatted, 'utf8', function (err) {
    if (err) return console.log(err);
});
})