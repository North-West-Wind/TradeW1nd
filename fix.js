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

readFile("./node_modules/ytdl-core/lib/index.js", { encoding: "utf8" }, function (_err, data) {
    var formatted = data.replace(/const ytdl = \((.|\n)*ytdl;/gm, ytdlFix);
    writeFile("./node_modules/ytdl-core/lib/index.js", formatted, 'utf8', function (err) {
        if (err) return console.log(err);
    });
});