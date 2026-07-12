export function updateTransform(code, id, prop, arrayVals) {
    const safeId = id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(parts\\.${prop}\\s*\\(\\s*['"]${safeId}['"]\\s*,\\s*\\[)[^\\]]+(\\]\\s*\\))`, 'g');
    
    const valsStr = arrayVals.map(n => {
        let v = n.toFixed(2); return (v === '-0.00') ? '0.00' : v;
    }).join(', ');
    
    if (regex.test(code)) return code.replace(regex, `$1${valsStr}$2`);
    return code;
}

export function deleteParts(code, ids) {
    let lines = code.split('\n');
    ids.forEach(id => {
        const safeId = id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`parts\\.[a-zA-Z0-9_]+\\s*\\([^;]*?['"]${safeId}['"]`);
        lines = lines.filter(line => !regex.test(line));
    });
    return lines.join('\n');
}

export function duplicateParts(code, ids) {
    let lines = code.split('\n');
    ids.forEach(id => {
        const safeId = id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(parts\\.)(add|pos|rot|scale)(\\s*\\(\\s*['"])${safeId}(['"])`);
        let newId = id + "_copy";
        let counter = 1;
        
        while(lines.some(l => l.includes(`"${newId}"`) || l.includes(`'${newId}'`))) newId = id + "_copy" + counter++;

        let newLines = [];
        for (let line of lines) {
            newLines.push(line);
            if (regex.test(line)) {
                let dup = line.replace(regex, `$1$2$3${newId}$4`);
                if (dup.includes('.pos(')) dup = dup.replace(/\[\s*([-.\d]+)/, (m, p1) => `[${(parseFloat(p1) + 5).toFixed(2)}`);
                newLines.push(dup);
            }
        }
        lines = newLines;
    });
    return lines.join('\n');
}

export function applyHollow(code, id, isChecked, factor) {
    const safeId = id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    let newCode = code.replace(new RegExp(`\\n?\\s*parts\\.hollow\\(\\s*['"]${safeId}['"].*?\\);?`, 'g'), '');
    
    if (isChecked) {
        const addRegex = new RegExp(`(parts\\.(scale|add|pos|rot)\\s*\\(\\s*['"]${safeId}['"].*?;)`);
        newCode = newCode.replace(addRegex, `$1\n    parts.hollow("${id}", ${factor});`);
    }
    return newCode;
}