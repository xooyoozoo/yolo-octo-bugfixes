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

var webpWorker = null;
(function() {
    var WebP = new Image();
    WebP.onload = WebP.onerror = function() {
        if (WebP.height != 2 && typeof(Worker) !== "undefined") {
            webpWorker = new Worker('js/webpjs-0.0.2.mod.js');
        }
    };
    WebP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
})();

var jp2kWorker = null;
(function() {
    var jp2k = new Image();
    jp2k.onerror = jp2k.load = function() {
        if ((!jp2k.width || jp2k.width === 0) && typeof(Worker) !== "undefined") {
            jp2kWorker = new Worker('js/openjpeg.js');
        }
    };
    jp2k.src = 'data:image/jp2;base64,AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAABAAAAAQAAw8HAAAAAAAPY29scgEAAAAAABAAAABpanAyY/9P/1EALwAAAAAABAAAAAQAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAAAAAw8BAQ8BAQ8BAf9SAAwAAAABAQAEBAAB/1wABECA/5AACgAAAAAAGAAB/5PP/BAQFABcr4CA/9k=';
})();

function elId(id) {
    return document.getElementById(id);
}

var fileSel = elId('fileSel');
var whichSel = [elId('leftSel'), elId('rightSel'), elId('scaling')];
var whichSide = [elId('leftContainer'), elId('rightContainer')];

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
var splitX = offset.width * .5;
var splitY = offset.height * .5;
var splitXTarget = splitX;
var splitYTarget = splitY;
var splitXStep = 0;
var splitYStep = 0;

var centerHead = elId('center-head');
var whichText = [elId('leftText'), elId('rightText')];
var urlFile;
var timer;
var textHeight = whichText[0].offsetHeight;
var first = 1;
var splitMode = 1;

fileSel.onchange = function() {
    whichSel[2].options[2].selected = true;
    setFile();
};
whichSel[0].onchange = function() {
    setSide('left');
};
whichSel[1].onchange = function() {
    setSide('right');
};
whichSel[2].onchange = setFile;

leftQual.onchange = function() {
    setSide('left');
};
rightQual.onchange = function() {
    setSide('right');
};

var slug = function(str) {
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
};

function processCanvasSize(inCanvas, width, height, el) {
    var scale = whichSel[2].options[whichSel[2].selectedIndex].getAttribute("value");
    if ( scale == 1 ) {
        return setSize(inCanvas.toDataURL(), width, height, el); // no resize needed
    }

    var outCanvas = document.createElement("canvas");
    outCanvas.width = Math.round(width*scale);
    outCanvas.height = Math.round(height*scale);

    window.pica.WW = false;
    window.pica.resizeCanvas(inCanvas, outCanvas,
        { quality: 3, alpha: false, unsharpAmount: 0, unsharpThreshold: 0, transferable: false },
        function (err) { console.log('Error', err); }
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
    if (el == whichSide[1]) {
        offset = {
            width: width,
            height: height
        };
        if (first) {
            splitX = splitXTarget = width * .5;
            splitY = splitYTarget = height * .5;
            first = 0;
        }
    }
    switchMode();
    setSplit();
}

function setSplit() {
    if (!timer) {
        timer = setInterval(function() {
            splitXStep *= .5;
            splitYStep *= .5;
            splitXStep += (splitXTarget - splitX) * .1;
            splitYStep += (splitYTarget - splitY) * .1;

            splitX += splitXStep;
            splitY += splitYStep;

            if (Math.abs(splitX - splitXTarget) < .5)
                splitX = splitXTarget;
            if (Math.abs(splitY - splitYTarget) < .5)
                splitY = splitYTarget;

            whichSide[0].style.width = splitX + "px";
            whichText[0].style.right = (offset.width - splitX) + "px";
            whichText[0].style.bottom = (offset.height - splitY) + "px";
            whichText[1].style.left = (splitX + 1) + "px";
            whichText[1].style.bottom = (offset.height - splitY) + "px";

            if (splitX == splitXTarget && splitY == splitYTarget) {
                clearInterval(timer);
                timer = null;
            }
        }, 20);
    }
}

function setImage(container, name, codec, setText) {
    container.style.background = "gray";
    container.style.backgroundImage = "";

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
        var blob_path = URL.createObjectURL(blob);

        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");

        if (codec == 'bpg') {
            var image = new BPGDecoder(ctx);
            image.onload = function() {
                canvas.width = this.imageData.width;
                canvas.height = this.imageData.height;
                ctx.putImageData(this.imageData, 0, 0);
                processCanvasSize(canvas, canvas.width, canvas.height, container);
            };
            image.load(blob_path);
        } else {
            var image = new Image();

            image.onload = function() {
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);
                processCanvasSize(canvas, image.width, image.height, container);
            };
            image.onerror = function() {
                var int_data = new Uint8Array(xhr.response);
                var output = null;

                if (codec == 'webp') {
                    webpWorker.onmessage = function(event) {
                        var bitmap = event.data.bitmap;
                        var biWidth = event.data.width;
                        var biHeight = event.data.height;
                        if (!bitmap) { return false; }

                        canvas.width = biWidth;
                        canvas.height = biHeight;
                        output = ctx.createImageData(canvas.width, canvas.height);
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
                    if (webpWorker) { webpWorker.postMessage(int_data); }
                } else if (codec == 'jp2') {
                    jp2kWorker.onmessage = function(event) {
                        var bitmap = event.data;
                        var pixelsPerChannel = bitmap.width * bitmap.height;
                        if (!bitmap) { return false; }

                        canvas.width = bitmap.width;
                        canvas.height = bitmap.height;
                        output = ctx.createImageData(canvas.width, canvas.height);

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
                    if (jp2kWorker) {
                        jp2kWorker.postMessage({
                            bytes: int_data,
                            extension: codec
                        });
                    }
                } else {
                    console.error("No support for " + url);
                    return false;
                }
            };
            image.src = blob_path;
        }
    };
    xhr.send();
}

function setSide(side) {
	var isRight = (side.toLowerCase() == 'right') ? 1 : 0;
	var whichQual = (isRight) ? rightQual : leftQual;
    var image = whichSel[isRight].options[whichSel[isRight].selectedIndex].getAttribute("value");
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
    viewOptions[2 + 2*isRight] = whichQual.options[whichQual.selectedIndex].getAttribute("value");

    setImage(whichSide[isRight], name, image,
        function(kbytes) {
            whichText[isRight].innerHTML = (isRight) ? "&rarr;&nbsp;" + kbytes : kbytes + "&nbsp;&larr;";
            textHeight = (isRight) ? textHeight : whichText[isRight].offsetHeight;
        });
    window.location.hash = viewOptions[0].concat('&',viewOptions[1],'=',viewOptions[2],
                                                 '&',viewOptions[3],'=',viewOptions[4]);
}

function setFile() {
    urlFile = fileSel.options[fileSel.selectedIndex].getAttribute("value");

    first = 1;
    viewOptions[0] = slug(fileSel.options[fileSel.selectedIndex].text);

    setSide('right');
    setSide('left');
}

function movesplit(event) {
    if (splitMode && urlFile) {
        var offset = whichSide[1].getBoundingClientRect();
        splitXTarget = event.clientX - offset.left;
        splitYTarget = event.clientY - offset.top;
        if (splitXTarget < 0) splitXTarget = 0;
        if (splitYTarget < textHeight) splitYTarget = textHeight;
        if (splitXTarget >= offset.width) splitXTarget = offset.width - 1;
        if (splitYTarget >= offset.height) splitYTarget = offset.height - 1;
        setSplit();
    }
    return false;
}

function switchMode(event) {
    var keyCode = (event) ? event.keyCode : 0;
    if (keyCode == "16") {
        splitMode = 0;
        var currLeft = (whichSide[0].offsetWidth > 1) ? 1 : 0; // current focus

        centerHead.innerHTML = whichSel[currLeft].options[whichSel[currLeft].selectedIndex].getAttribute("value")
                          + ' ' + whichText[currLeft].innerHTML.replace(/&nbsp;/g, '').replace(/←|→/g, '');

        whichSide[0].style.borderRight = "none";
        whichSide[0].style.width = (offset.width * (1-currLeft) * 0.99999) + "px";
    } else if (!splitMode) {
        whichSide[0].style.borderRight = "1px dotted white";
        whichSide[0].style.width = splitX + "px";
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
            if (slug(opt.text) == hashArray[0].substring(1)) {
                fileSel.selectedIndex = j;
                var s, q;
                if (leftOpts) {
                    s = document.querySelector('#leftSel [value="' + leftOpts[0] + '"]');
                    if (s) {s.selected = true}
                    q = document.querySelector('#leftQual [value="' + leftOpts[1] + '"]');
                    if (q) {q.selected = true}
                }
                if (rightOpts) {
                    s = document.querySelector('#rightSel [value="' + rightOpts[0] + '"]');
                    if (s) {s.selected = true}
                    q = document.querySelector('#rightQual [value="' + rightOpts[1] + '"]');
                    if (q) {q.selected = true}
                }
                break;
            }
        }
    }
}

getWindowsOptions();

window.addEventListener("load", function() {setFile();}, false);
window.addEventListener("keydown", switchMode, false);

whichSide[1].addEventListener("mousemove", movesplit, false);
whichSide[1].addEventListener("click", movesplit, false);

whichText[1].style.backgroundColor = "rgba(0,0,0,.3)";
whichText[0].style.backgroundColor = "rgba(0,0,0,.3)";
