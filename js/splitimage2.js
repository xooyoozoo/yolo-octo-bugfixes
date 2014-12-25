(function() {   /* alphabetize, randomize */
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
})();

var workers = {bpg: undefined, jp2: undefined, jxr: undefined, webp: undefined};
var nativeDec = {bpg: false, jp2: false, jxr: false, webp: false};
checkDecSupport('jp2', 4, 'data:image/jp2;base64,AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAABAAAAAQAAw8HAAAAAAAPY29scgEAAAAAABAAAABpanAyY/9P/1EALwAAAAAABAAAAAQAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAAAAAw8BAQ8BAQ8BAf9SAAwAAAABAQAEBAAB/1wABECA/5AACgAAAAAAGAAB/5PP/BAQFABcr4CA/9k=');
checkDecSupport('jxr', 1, 'data:image/vnd.ms-photo;base64,SUm8AQgAAAAFAAG8AQAQAAAASgAAAIC8BAABAAAAAQAAAIG8BAABAAAAAQAAAMC8BAABAAAAWgAAAMG8BAABAAAAHwAAAAAAAAAkw91vA07+S7GFPXd2jckNV01QSE9UTwAZAYBxAAAAABP/gAAEb/8AAQAAAQAAAA==');
checkDecSupport('webp', 2, 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA');

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

/* */
var canvases = {
    left: createCanvas(800, 800),
    right: createCanvas(800, 800)
}
function createCanvas(width, height) {
    var c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
}

function checkDecSupport(flag, decodedWidth, encodedUrl) {
	var img = new Image();
	img.onload = img.onerror = function() {
		if (img.width && img.width === decodedWidth) { nativeDec[flag] = true; };
	}
	img.src = encodedUrl;
}

/* file|codec|qual > setSide > setImage > setSize > setSplit */
fileSel.onchange = function() {
    scaleSel.options[2].selected = true;
    setFile();
};
scaleSel.onchange = processCanvasScale;
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

function getSelValue(el, attr) {
    return el.options[el.selectedIndex].getAttribute(attr);
}

/* Get web-friendly string */
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

/* Create new worker if needed. Terminate worker if unneeded. */
function checkWorkers(selIdx) {
    var curSel = getSelValue(whichSel[selIdx], 'value');
    var img = { l: getSelValue(whichSel[0], 'value'),
                r: getSelValue(whichSel[1], 'value') };

    processWorker('jp2');
    processWorker('jxr');
    processWorker('webp');

    function processWorker(codec) {
        if (img.l != codec && img.r != codec) {
            if (workers[codec] !== undefined) {
                workers[codec].terminate();
                workers[codec] = undefined;
            }
        } else if (!nativeDec[codec] && curSel==codec && workers[codec]===undefined) {
            workers[codec] = new Worker('js/' + codec + 'Worker.js');
        }
    }
}

/* Uses Lanczos2 for rescaling. In-browser too blurry. Lanczos3 too slow. */
function processCanvasScale(canvas, container) {
    if (container) {
        // Process only one side
        scaleCanvas(canvas, container);
    } else {
        // Process both sides at once
        scaleCanvas(canvases.right, whichSide[1]);
        scaleCanvas(canvases.left, whichSide[0]);
    }

    function scaleCanvas(inCanvas, el) {
        var width, height, scale;
        width = inCanvas.width;
        height = inCanvas.height;
        scale = getSelValue(scaleSel, 'value');

        if ( scale == 1 ) {
            return setSize(inCanvas, el);
        }

        var outCanvas = document.createElement("canvas");
        outCanvas.width = Math.round(width*scale);
        outCanvas.height = Math.round(height*scale);

        window.pica.WW = true;
        window.pica.resizeCanvas(inCanvas, outCanvas,
            { quality: 2, alpha: false, unsharpAmount: 0,
              unsharpThreshold: 0, transferable: true },
            function() { setSize(outCanvas, el); }
        )
    }
}

function setSize(inCanvas, el) {
	var src, width, height;
	src = inCanvas.toDataURL();
	width = inCanvas.width;
	height = inCanvas.height;
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

function setImage(side, pathBase, codec, setText) {
    var canvas = (side == 'left') ? canvases.left : canvases.right;
    var container = (side == 'left') ? whichSide[0] : whichSide [1];
    if ( container == whichSide[0] || first ) {
        container.style.backgroundColor = "#c6c6c6";
        container.style.backgroundImage = "";
    };
    container.style.opacity = 0.5;

    var path = 'comparisonfiles/'.concat(pathBase, '/', urlFile, '.', codec);
    var xhr = new XMLHttpRequest();

    xhr.open("GET", path, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function() {
        setText( (xhr.response.byteLength/1024).toFixed(1) + " KB" );

        var mimeCodec = (codec=='jxr') ? 'vnd.ms-photo' : codec;
        var blob = new Blob([xhr.response], {
            type: "image/" + mimeCodec
        });
        var blobPath = window.URL.createObjectURL(blob);

        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        var image = new Image();

        if (codec == 'bpg') {
            var bpg = new BPGDecoder(canvas.getContext("2d"));
            bpg.onload = function() {
                canvas.width = bpg.imageData.width;
                canvas.height = bpg.imageData.height;
                canvas.getContext("2d").putImageData(bpg.imageData, 0, 0);
                processCanvasScale(canvas, container);
                window.URL.revokeObjectURL(blobPath);
            };
            bpg.load(blobPath);
        } else {
            image.onload = function() {
                canvas.width = image.width;
                canvas.height = image.height;
                canvas.getContext("2d").drawImage(image, 0, 0);
                processCanvasScale(canvas, container);
                window.URL.revokeObjectURL(blobPath);
            };
            image.onerror = function() {
                var arrayData = new Uint8Array(xhr.response);

                if (codec == 'jp2' || codec == 'j2k') {
                    j2kArrayToCanvas(arrayData, codec, canvas, container);
                } else if (codec == 'jxr') {
                    workers.jxr.onmessage = function(event) {
                        var jxrBmp = new Blob([new DataView(event.data.buffer)], {type: "image/bmp"});
                        jxrBmpToCanvas(jxrBmp, canvas, container);
                    };
                    if (workers.jxr !== undefined) { workers.jxr.postMessage(xhr.response); }
                    else console.error("Cannot decode JPEG XR.");
                } else if (codec == 'webp') {
                    webpArrayToCanvas(arrayData, canvas, container);
                } else { console.error("No support for " + url); }
            };
            image.src = blobPath;
        }
    };
    xhr.send();

	function j2kArrayToCanvas(encData, codec, canvas, container) {
	    workers.jp2.onmessage = function(event) {
	        var bitmap = event.data.data;
	        if (!bitmap) { return false; }

	        canvas.width = event.data.width;
	        canvas.height = event.data.height;
	        var ctx = canvas.getContext("2d");
	        var output = ctx.createImageData(canvas.width, canvas.height);
            var outputData = output.data;

            var pixelsPerChannel = canvas.width * canvas.height;
	        var i = 0,
	            j = 0;
	        while (i < outputData.length && j < pixelsPerChannel) {
	            outputData[i] = bitmap[j]; // R
	            outputData[i + 1] = bitmap[j + pixelsPerChannel]; // G
	            outputData[i + 2] = bitmap[j + (2 * pixelsPerChannel)]; // B
	            outputData[i + 3] = 255; // A
	            i += 4;
	            j += 1;
	        };
	        ctx.putImageData(output, 0, 0);
	        processCanvasScale(canvas, container);
	    };
	    if (workers.jp2 !== undefined) {
	        workers.jp2.postMessage({
	            bytes: encData,
	            extension: codec
	        });
	    } else console.error("Cannot decode JPEG 2000.");
	};
    function jxrBmpToCanvas(jxrBmp, canvas, container) {
        var bmpUrl = window.URL.createObjectURL(jxrBmp);
        var img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d").drawImage(img, 0, 0);
            processCanvasScale(canvas, container);
            window.URL.revokeObjectURL(bmpUrl);
        };
        img.src = bmpUrl;
    };
	function webpArrayToCanvas(encData, canvas, container) {
	    workers.webp.onmessage = function(event) {
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
	        processCanvasScale(canvas, container);
	    };
	    if (workers.webp !== undefined) {
	        workers.webp.postMessage(encData);
	    } else console.error("Cannot decode WebP.");
	}
}

function setSide(side) {
	var isRight = (side.toLowerCase() == 'right') ? 1 : 0;
	var whichQual = (isRight) ? rightQual : leftQual;
    var image = getSelValue(whichSel[isRight], 'value');
    var pathBase = getSelValue(whichSel[isRight], 'folder');

    if (pathBase != 'Original') {
        whichQual.disabled=false;
        var quality = whichQual.options[whichQual.selectedIndex].innerHTML.toLowerCase() + '/';
    } else {
        whichQual.disabled=true;
        var quality = '';
    }

    pathBase = quality + pathBase;
    viewOptions[1 + 2*isRight] = image;
    viewOptions[2 + 2*isRight] = getSelValue(whichQual, 'value');

    setImage(side.toLowerCase(), pathBase, image,
        function(kbytes) {
            whichText[isRight].innerHTML = (isRight) ? "&rarr;&nbsp;" + kbytes : kbytes + "&nbsp;&larr;";
            textHeight = (isRight) ? textHeight : whichText[isRight].offsetHeight;
        });
    window.location.hash = viewOptions[0].concat('&',viewOptions[1],'=',viewOptions[2],
                                                 '&',viewOptions[3],'=',viewOptions[4]);
}

function setFile() {
	console.log('Native image decoders: ', nativeDec);
    urlFile = getSelValue(fileSel, 'value');

    /* Flag for special processing when both left & right are both new. */
    first = 1;
    /* Any view change will update hash. */
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

/* Shift key to enter 'flip-view'. Repeat to flip between images. Any other key to return to split-view. */
function switchMode(event) {
    var keyCode = (event) ? event.keyCode : 0;
    if (keyCode == "16") {
        splitMode = 0;
        var currLeft = (whichSide[0].offsetWidth > 1) ? 1 : 0; // current focus

        centerHead.innerHTML = getSelValue(whichSel[currLeft], 'value') + ' '
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

/* Process URL hash for direct links. */
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
