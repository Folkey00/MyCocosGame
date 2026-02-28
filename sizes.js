const fs = require('fs');
const path = require('path');
function getSizes(dir, list) {
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) getSizes(p, list);
        else list.push({ p, s: st.size / 1024 / 1024 });
    });
    return list;
}
let sizes = getSizes('build/web-mobile', []);
sizes.sort((a, b) => b.s - a.s);
sizes.slice(0, 15).forEach(x => console.log(x.s.toFixed(2) + ' MB: ' + x.p));
