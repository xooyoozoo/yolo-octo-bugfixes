(function() {
    var file = document.getElementById('fileSel');
    var fileTexts = new Array();
    var selCandidates = new Array()

    for (i = 0; i < file.length; i++) {
        fileTexts[i] =
            file.options[i].text.toUpperCase() + "|=" +
            file.options[i].text + "|=" +
            file.options[i].value + "|=" +
            file.options[i].selected;
    }
    fileTexts.sort();

    for (i = 0; i < file.length; i++) {
        var parts = fileTexts[i].split('|=');

        file.options[i].text = parts[1];
        file.options[i].value = parts[2];
        if (parts[3] == "true") { selCandidates.push(file.options[i]); }
    }
    file.multiple = false;
    selCandidates[Math.floor(Math.random() * selCandidates.length)].selected = true;
})(); // alphabetize, randomize

var webpWorker;
var webpDecoder = 0;
(function() {
    var webp = new Image();
    webp.onload = webp.onerror = function() {
        if (webp.height == 2) { webpDecoder = 1; }
    };
    webp.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
})();

var jp2Worker;
var jp2Decoder = 0;
(function() {
    var jp2 = new Image();
    jp2.onerror = jp2.load = function() {
        if (jp2.width && jp2.width !== 0) { jp2Decoder = 1; }
    };
    jp2.src = 'data:image/jp2;base64,AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAABAAAAAQAAw8HAAAAAAAPY29scgEAAAAAABAAAABpanAyY/9P/1EALwAAAAAABAAAAAQAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAAAAAw8BAQ8BAQ8BAf9SAAwAAAABAQAEBAAB/1wABECA/5AACgAAAAAAGAAB/5PP/BAQFABcr4CA/9k=';
})();

var fileSel = getElId('fileSel');
var scaleSel = getElId('scaling');
var whichSel = [getElId('leftSel'), getElId('rightSel')];
var whichSide = [getElId('leftContainer'), getElId('rightContainer')];

var viewOptions = [
    '', /* file */
    '', /* left-image */
    '', /* left-quality */
    '', /* right-image */
    ''  /* right-quality */
];

var offset = {
    width: whichSide[1].getBoundingClientRect().width,
    height: whichSide[1].getBoundingClientRect().height
};
var split = {
    x: 0.5 * offset.width,
    y: 0.5 * offset.height
};
var splitTarget = {x: split.x, y: split.y};
var splitStep = {x: 0, y: 0};

var centerHead = getElId('center-head');
var whichText = [getElId('leftText'), getElId('rightText')];
var urlFile;
var timer;
var textHeight = whichText[0].offsetHeight;
var first = 1;
var splitMode = 1;

fileSel.onchange = function() {
    scaleSel.options[2].selected = true;
    setFile();
};
scaleSel.onchange = setFile;
whichSel[0].onchange = function() {
    checkWorkers(0);
    setSide('left');
};
whichSel[1].onchange = function() {
    checkWorkers(1);
    setSide('right');
};

leftQual.onchange = function() {
    setSide('left');
};
rightQual.onchange = function() {
    setSide('right');
};

function getElId(id) {
    return document.getElementById(id);
}

function getSelValue(el) {
    return el.options[el.selectedIndex].getAttribute("value");
}

function getSlugName(str) {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();

    // remove accents, swap ñ for n, etc
    var from = "ãàáäâẽèéëêìíïîõòóöôùúüûñç·/_,:;";
    var to   = "aaaaaeeeeeiiiiooooouuuunc------";
    for (var i=0, l=from.length ; i<l ; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

    return str;
}

function checkWorkers(selIdx) {
    var curSel = getSelValue(whichSel[selIdx]);
    var img = { l: getSelValue(whichSel[0]),
                r: getSelValue(whichSel[1]) };

    processWorker('webp');
    processWorker('jp2');

    function processWorker(codec) {
        eval("var worker = " + codec +"Worker");
        eval("var canDecode = " + codec + "Decoder");

        if (img.l != codec && img.r != codec) {
            if (worker !== undefined) {
                eval(codec +"Worker.terminate()");
                eval(codec +"Worker = undefined");            }
        } else if (canDecode==0 && curSel==codec && worker===undefined) {
            eval(codec + "Worker = new Worker('js/"+ codec +"Worker.js')");
        }
    }
}

function processCanvasSize(inCanvas, width, height, el) {
    var scale = getSelValue(scaleSel);
    if ( scale == 1 ) {
        return setSize(inCanvas.toDataURL(), width, height, el); // no resize needed
    }

    var outCanvas = document.createElement("canvas");
    outCanvas.width = Math.round(width*scale);
    outCanvas.height = Math.round(height*scale);

    window.pica.WW = false;
    window.pica.resizeCanvas(inCanvas, outCanvas,
        { quality: 2, alpha: false, unsharpAmount: 0, unsharpThreshold: 0, transferable: false },
        function (err) { return; }
    )

    setSize(outCanvas.toDataURL(), outCanvas.width, outCanvas.height, el);
}

function setSize(src, width, height, el) {
    if (first) {
        whichSide[0].style.height = height + "px";
        whichSide[1].style.height = height + "px";
    } else el.style.height = height + "px";

    el.style.width = width + "px";
    el.style.backgroundImage = 'url(\"' + src + '\")';
    el.style.backgroundColor = "";
    el.style.opacity = 1;
    if (el == whichSide[1]) {
        offset = {
            width: width,
            height: height
        };
        if (first) {
            split.x = splitTarget.x = width * .5;
            split.y = splitTarget.y = height * .5;
            first = 0;
        }
    }
    switchMode();
    setSplit();
}

function setSplit() {
    if (!timer) {
        timer = setInterval(function() {
            splitStep.x *= .5;
            splitStep.y *= .5;
            splitStep.x += (splitTarget.x - split.x) * .1;
            splitStep.y += (splitTarget.y - split.y) * .1;

            split.x += splitStep.x;
            split.y += splitStep.y;

            if (Math.abs(split.x - splitTarget.x) < .5)
                split.x = splitTarget.x;
            if (Math.abs(split.y - splitTarget.y) < .5)
                split.y = splitTarget.y;

            whichSide[0].style.width = split.x + "px";
            whichText[0].style.right = (offset.width - split.x) + "px";
            whichText[0].style.bottom = (offset.height - split.y) + "px";
            whichText[1].style.left = (split.x + 1) + "px";
            whichText[1].style.bottom = (offset.height - split.y) + "px";

            if (split.x == splitTarget.x && split.y == splitTarget.y) {
                clearInterval(timer);
                timer = null;
            }
        }, 20);
    }
}

function setImage(container, name, codec, setText) {
    if ( container == whichSide[0] || first ) {
        container.style.backgroundColor = "#c6c6c6";
        container.style.backgroundImage = "";
    };
    container.style.opacity = 0.5;

    var path = 'comparisonfiles/'.concat(name, '/', urlFile, '.', codec);
    var xhr = new XMLHttpRequest();

    xhr.open("GET", path, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function() {
        var kbytes = (xhr.response.byteLength / 1024).toFixed(1) + " KB";
        setText(kbytes);

        var blob = new Blob([xhr.response], {
            type: "image/" + codec
        });
        var blobPath = URL.createObjectURL(blob);

        var canvas = document.createElement("canvas");
        var image = new Image();

        image.onload = function() {
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext("2d").drawImage(image, 0, 0);
            processCanvasSize(canvas, image.width, image.height, container);
        };
        image.onerror = function() {
            var arrayData = new Uint8Array(xhr.response);
            var output = null;
            if (codec == 'bpg') {
                var bpg = new BPGDecoder(canvas.getContext("2d"));
                bpg.onload = function() {
                    canvas.width = bpg.imageData.width;
                    canvas.height = bpg.imageData.height;
                    canvas.getContext("2d").putImageData(bpg.imageData, 0, 0);
                    processCanvasSize(canvas, canvas.width, canvas.height, container);
                };
                bpg.load(blobPath);
            } else if (codec == 'webp') {
                webpArrayToCanvas(arrayData, canvas, container);
            } else if (codec == 'jp2' || codec == 'j2k') {
                j2kArrayToCanvas(arrayData, codec, canvas, container);
            } else {
                console.error("No support for " + url);
                return false;
            }
        };
        image.src = blobPath;
    };
    xhr.send();
}

function j2kArrayToCanvas(encData, codec, canvas, container) {
    jp2Worker.onmessage = function(event) {
        var bitmap = event.data;
        var pixelsPerChannel = bitmap.width * bitmap.height;
        if (!bitmap) { return false; }

        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        var ctx = canvas.getContext("2d");
        var output = ctx.createImageData(canvas.width, canvas.height);

        var i = 0,
            j = 0;
        while (i < output.data.length && j < pixelsPerChannel) {
            output.data[i] = bitmap.data[j]; // R
            output.data[i + 1] = bitmap.data[j + pixelsPerChannel]; // G
            output.data[i + 2] = bitmap.data[j + (2 * pixelsPerChannel)]; // B
            output.data[i + 3] = 255; // A
            i += 4;
            j += 1;
        };
        ctx.putImageData(output, 0, 0);
        processCanvasSize(canvas, canvas.width, canvas.height, container);
    };
    if (jp2Worker !== undefined) {
        jp2Worker.postMessage({
            bytes: encData,
            extension: codec
        });
    } else console.log("Cannot decode JPEG 2000.");
}

function webpArrayToCanvas(encData, canvas, container) {
    webpWorker.onmessage = function(event) {
        var bitmap = event.data.bitmap;
        var biWidth = event.data.width;
        var biHeight = event.data.height;
        if (!bitmap) { return false; }

        canvas.width = biWidth;
        canvas.height = biHeight;
        var ctx = canvas.getContext("2d");
        var output = ctx.createImageData(canvas.width, canvas.height);
        var outputData = output.data;

        for (var h = 0; h < biHeight; h++) {
            for (var w = 0; w < biWidth; w++) {
                outputData[0 + w * 4 + (biWidth * 4) * h] = bitmap[1 + w * 4 + (biWidth * 4) * h];
                outputData[1 + w * 4 + (biWidth * 4) * h] = bitmap[2 + w * 4 + (biWidth * 4) * h];
                outputData[2 + w * 4 + (biWidth * 4) * h] = bitmap[3 + w * 4 + (biWidth * 4) * h];
                outputData[3 + w * 4 + (biWidth * 4) * h] = bitmap[0 + w * 4 + (biWidth * 4) * h];
            };
        };
        ctx.putImageData(output, 0, 0);
        processCanvasSize(canvas, canvas.width, canvas.height, container);
    };
    if (webpWorker !== undefined) {
        webpWorker.postMessage(encData);
    } else console.log("Cannot decode WebP.");
}

function setSide(side) {
	var isRight = (side.toLowerCase() == 'right') ? 1 : 0;
	var whichQual = (isRight) ? rightQual : leftQual;
    var image = getSelValue(whichSel[isRight]);
    var name = whichSel[isRight].options[whichSel[isRight].selectedIndex].innerHTML;

    if (name != 'Original') {
        whichQual.disabled=false;
        var quality = whichQual.options[whichQual.selectedIndex].innerHTML.toLowerCase() + '/';
    } else {
        whichQual.disabled=true;
        var quality = '';
    }

    name = quality + name;
    viewOptions[1 + 2*isRight] = image;
    viewOptions[2 + 2*isRight] = getSelValue(whichQual);

    setImage(whichSide[isRight], name, image,
        function(kbytes) {
            whichText[isRight].innerHTML = (isRight) ? "&rarr;&nbsp;" + kbytes : kbytes + "&nbsp;&larr;";
            textHeight = (isRight) ? textHeight : whichText[isRight].offsetHeight;
        });
    window.location.hash = viewOptions[0].concat('&',viewOptions[1],'=',viewOptions[2],
                                                 '&',viewOptions[3],'=',viewOptions[4]);
}

function setFile() {
    urlFile = getSelValue(fileSel);

    first = 1;
    viewOptions[0] = getSlugName(fileSel.options[fileSel.selectedIndex].text);

    setSide('right');
    setSide('left');
}

function moveSplit(event) {
    if (splitMode && urlFile) {
        var offset = whichSide[1].getBoundingClientRect();
        splitTarget.x = event.clientX - offset.left;
        splitTarget.y = event.clientY - offset.top;
        if (splitTarget.x < 0) splitTarget.x = 0;
        if (splitTarget.y < textHeight) splitTarget.y = textHeight;
        if (splitTarget.x >= offset.width) splitTarget.x = offset.width - 1;
        if (splitTarget.y >= offset.height) splitTarget.y = offset.height - 1;
        setSplit();
    }
    return false;
}

function switchMode(event) {
    var keyCode = (event) ? event.keyCode : 0;
    if (keyCode == "16") {
        splitMode = 0;
        var currLeft = (whichSide[0].offsetWidth > 1) ? 1 : 0; // current focus

        centerHead.innerHTML = getSelValue(whichSel[currLeft]) + ' '
                             + whichText[currLeft].innerHTML.replace(/&nbsp;/g, '').replace(/←|→/g, '');

        whichSide[0].style.borderRight = "none";
        whichSide[0].style.width = (offset.width * (1-currLeft) * 0.99999) + "px";
    } else if (!splitMode) {
        whichSide[0].style.borderRight = "1px dotted white";
        whichSide[0].style.width = split.x + "px";
        centerHead.innerHTML = "--- vs ---";
        splitMode = 1;
    }

    whichText[0].style.opacity = splitMode;
    whichText[1].style.opacity = splitMode;
}

function getWindowsOptions() {
    if (window.location.hash) {
        var hashArray = (location.hash+'&='+'&=').split('&', 5);
        var leftOpts = hashArray[1].split('=', 2);
        var rightOpts = hashArray[2].split('=', 2);
        var imageSet = fileSel.options;
        for (var opt, j = 0; opt = imageSet[j]; j++) {
            if (getSlugName(opt.text) == hashArray[0].substring(1)) {
                fileSel.selectedIndex = j;
                var s, q;
                if (leftOpts) {
                    s = document.querySelector('#leftSel [value="' + leftOpts[0] + '"]');
                    if (s) {s.selected = true};
                    q = document.querySelector('#leftQual [value="' + leftOpts[1] + '"]');
                    if (q) {q.selected = true};
                    checkWorkers(0);
                }
                if (rightOpts) {
                    s = document.querySelector('#rightSel [value="' + rightOpts[0] + '"]');
                    if (s) {s.selected = true};
                    q = document.querySelector('#rightQual [value="' + rightOpts[1] + '"]');
                    if (q) {q.selected = true};
                    checkWorkers(1);
                }
                break;
            }
        };
    }
}

getWindowsOptions();

window.addEventListener("load", function() {setFile();}, false);
window.addEventListener("keydown", switchMode, false);

whichSide[1].addEventListener("mousemove", moveSplit, false);
whichSide[1].addEventListener("click", moveSplit, false);

whichText[1].style.backgroundColor = "rgba(0,0,0,.3)";
whichText[0].style.backgroundColor = "rgba(0,0,0,.3)";
