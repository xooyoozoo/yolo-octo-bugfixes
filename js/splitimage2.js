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

var workers = {
    bpg: undefined,
    jp2: undefined, jxr: undefined, webp: undefined
};
var nativeDec = {
    bpg: false, jp2: false, jxr: false, webp: false,
    check: function(flag, decodedWidth, encodedUrl) {
        var supports = this;
        var img = new Image();
        img.src = encodedUrl;
        img.onload = img.onerror = function() {
            supports[flag] = (img.width && img.width === decodedWidth);
        }
    }
};

nativeDec.check('jp2', 4, 'data:image/jp2;base64,AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAABAAAAAQAAw8HAAAAAAAPY29scgEAAAAAABAAAABpanAyY/9P/1EALwAAAAAABAAAAAQAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAAAAAw8BAQ8BAQ8BAf9SAAwAAAABAQAEBAAB/1wABECA/5AACgAAAAAAGAAB/5PP/BAQFABcr4CA/9k=');
nativeDec.check('jxr', 1, 'data:image/vnd.ms-photo;base64,SUm8AQgAAAAFAAG8AQAQAAAASgAAAIC8BAABAAAAAQAAAIG8BAABAAAAAQAAAMC8BAABAAAAWgAAAMG8BAABAAAAHwAAAAAAAAAkw91vA07+S7GFPXd2jckNV01QSE9UTwAZAYBxAAAAABP/gAAEb/8AAQAAAQAAAA==');
nativeDec.check('webp', 2, 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA');

var select = {
    file: getElId('fileSel'), scale: getElId('scaleSel'),
    left: getElId('leftSel'), right: getElId('rightSel')
};

var view = {
    left: getElId('leftContainer'),
    right: getElId('rightContainer')
};

var viewOptions = {
    file: '', scale: '',
    left: '', leftQ: '',
    right: '', rightQ: ''
};

var offset = {
    width: (view.right).getBoundingClientRect().width,
    height: (view.right).getBoundingClientRect().height
};
var split = {
    x: 0.5 * offset.width,
    y: 0.5 * offset.height
};
var splitTarget = {
    x: split.x,
    y: split.y
};
var splitStep = {
    x: 0,
    y: 0
};

var infoText = {
    left: getElId('leftText'),
    right: getElId('rightText'),
    center: getElId('center-head')
};

var urlFolder, urlFile;
var timer;
var textHeight = infoText.left.offsetHeight;
var first = 1;
var splitMode = 1;

var canvases = {
    left: prepCanvas(800, 800),
    right: prepCanvas(800, 800),
    leftScaled: prepCanvas(100, 100),
    rightScaled: prepCanvas(100, 100)
}
function prepCanvas(width, height, which) {
    var c;

    if (which !== undefined) {
        c = which;
        c.getContext("2d").clearRect(0, 0, c.width, c.height);
    }
    else { c = document.createElement("canvas"); }

    c.width = width;
    c.height = height;
    return c;
}

/* file|scale|codec|qual > setSide > setImage > processCanvasScale > setSize > setSplit */
select.file.onchange = function() {
    //select.scale.options[2].selected = true;
    setFile();
};

select.scale.onchange = processCanvasScale;

select.left.onchange = function() {
    checkWorkers('left');
    setSide('left');
};
select.right.onchange = function() {
    checkWorkers('right');
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
function checkWorkers(sel) {
    var curSel = getSelValue(select[sel], 'value');
    var img = { l: getSelValue(select.left, 'value'),
                r: getSelValue(select.right, 'value') };

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
function processCanvasScale(canvas, choseSide) {
    if (choseSide) {
        // Process only one side
        scaleCanvas(canvas, choseSide);
    } else {
        // Process both sides at once
        scaleCanvas(canvases.right, 'right');
        scaleCanvas(canvases.left, 'left');
    }

    function scaleCanvas(inCanvas, side) {
        var scale = getSelValue(scaleSel, 'value');
        var outCnvs = canvases[side + 'Scaled'];

        if ( scale == 1 ) {
            viewOptions.scale = '';
            prepCanvas(100, 100, outCnvs);
            return setSize(inCanvas, side);
        }

        var width = Math.round(inCanvas.width * scale);
        var height = Math.round(inCanvas.height * scale);

        viewOptions.scale = '*' + getSelValue(scaleSel, 'ratio');
        prepCanvas(width, height, outCnvs);

        window.pica.WW = true;
        window.pica.resizeCanvas(inCanvas, outCnvs,
            { quality: 2, alpha: false, unsharpAmount: 0,
              unsharpThreshold: 0, transferable: true },
            function() { setSize(outCnvs, side); }
        )
    }
}

function setSize(inCanvas, side) {
	var src, width, height, el;
	src = inCanvas.toDataURL();
	width = inCanvas.width;
	height = inCanvas.height;
    el = view[side];
    if (first) {
        view.left.style.height = height + "px";
        view.right.style.height = height + "px";
    } else el.style.height = height + "px";

    el.style.width = width + "px";
    el.style.backgroundImage = 'url(\"' + src + '\")';
    el.style.backgroundColor = "";
    el.style.opacity = 1;
    if (el == view.right) {
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
    window.location.hash = (viewOptions.file).concat(viewOptions.scale,
                                              '&',viewOptions.left,'=',viewOptions.leftQ,
                                              '&',viewOptions.right,'=',viewOptions.rightQ);
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

            view.left.style.width = split.x + "px";
            infoText.left.style.right = (offset.width - split.x) + "px";
            infoText.left.style.bottom = (offset.height - split.y) + "px";
            infoText.right.style.left = (split.x + 1) + "px";
            infoText.right.style.bottom = (offset.height - split.y) + "px";

            if (split.x == splitTarget.x && split.y == splitTarget.y) {
                clearInterval(timer);
                timer = null;
            }
        }, 20);
    }
}

function setImage(side, pathBase, codec, setText) {
    var canvas = canvases[side];

    if ( side == 'left' || first ) {
        view[side].style.backgroundColor = "#c6c6c6";
        view[side].style.backgroundImage = "";
    };
    view[side].style.opacity = 0.5;

    var path = urlFolder.concat(pathBase, '/', urlFile, '.', codec);
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

        var canvas = canvases[side];
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

        if (codec == 'bpg') {
            var bpg = new BPGDecoder(canvas.getContext("2d"));
            bpg.onload = function() {
                canvas.width = bpg.imageData.width;
                canvas.height = bpg.imageData.height;
                canvas.getContext("2d").putImageData(bpg.imageData, 0, 0);
                processCanvasScale(canvas, side);
                window.URL.revokeObjectURL(blobPath);
            };
            bpg.load(blobPath);
        } else {
            var image = new Image();
            image.onload = function() {
                canvas.width = image.width;
                canvas.height = image.height;
                canvas.getContext("2d").drawImage(image, 0, 0);
                processCanvasScale(canvas, side);
                window.URL.revokeObjectURL(blobPath);
            };
            image.onerror = function() {
                var arrayData = new Uint8Array(xhr.response);

                if (codec == 'jp2' || codec == 'j2k') {
                    /* JPEG 2000 decoding */
                    j2kArrayToCanvas(arrayData, codec, canvas);
                } else if (codec == 'jxr') {
                    /* JPEG XR decoding */
                    workers.jxr.onmessage = function(event) {
                        var jxrBmp = new Blob([new DataView(event.data.buffer)], {type: "image/bmp"});
                        jxrBmpToCanvas(jxrBmp, canvas);
                    };
                    if (workers.jxr !== undefined) { workers.jxr.postMessage(xhr.response); }
                    else console.error("Cannot decode JPEG XR.");
                } else if (codec == 'webp') {
                    /* WebP decoding */
                    webpArrayToCanvas(arrayData, canvas);
                } else { console.error("No support for " + url); }
            };
            image.src = blobPath;
        }
    };
    xhr.send();

	function j2kArrayToCanvas(encData, codec, canvas) {
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
	        processCanvasScale(canvas, side);
	    };
	    if (workers.jp2 !== undefined) {
	        workers.jp2.postMessage({
	            bytes: encData,
	            extension: codec
	        });
	    } else console.error("Cannot decode JPEG 2000.");
	};
    function jxrBmpToCanvas(jxrBmp, canvas) {
        var bmpUrl = window.URL.createObjectURL(jxrBmp);
        var img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d").drawImage(img, 0, 0);
            processCanvasScale(canvas, side);
            window.URL.revokeObjectURL(bmpUrl);
        };
        img.src = bmpUrl;
    };
	function webpArrayToCanvas(encData, canvas) {
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
	        processCanvasScale(canvas, side);
	    };
	    if (workers.webp !== undefined) {
	        workers.webp.postMessage(encData);
	    } else console.error("Cannot decode WebP.");
	}
}

function setSide(side) {
	var isRight = (side == 'right') ? 1 : 0;
	var whichQual = (isRight) ? rightQual : leftQual;
    var image = getSelValue(select[side], 'value');
    var pathBase = getSelValue(select[side], 'folder');

    if (pathBase != 'Original' && urlFolder != 'psycomp/') {
        whichQual.disabled=false;
        var quality = whichQual.options[whichQual.selectedIndex].innerHTML.toLowerCase() + '/';
    } else {
        whichQual.disabled=true;
        var quality = '';
    }

    pathBase = quality + pathBase;
    viewOptions[side] = image;
    viewOptions[side + 'Q'] = getSelValue(whichQual, 'value');

    setImage(side.toLowerCase(), pathBase, image,
        function(kbytes) {
            infoText[side].innerHTML = (isRight) ? "&rarr;&nbsp;" + kbytes : kbytes + "&nbsp;&larr;";
            textHeight = (isRight) ? textHeight : infoText[side].offsetHeight;
        });
}

function setFile() {
    urlFile = getSelValue(select.file, 'value');
    /*if (urlFile === 'random') {
        var chosen = getRandExtra();

        urlFile = chosen.name;
        urlFolder = 'randomextras/';

        select.file.options[select.file.options.length - 2].selected = true;
    }*/

    /* Flag for special processing when both left & right are both new. */
    first = 1;
    /* Any view change will update hash. */
    viewOptions.file = getSlugName(select.file.options[select.file.selectedIndex].text);
    if (urlFolder == 'psycomp/') { viewOptions.file = 'psycomp#' + viewOptions.file; }

    setSide('right');
    setSide('left');
}

function loadScript(url, callback) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.onload = callback;
    script.src = url;

    head.appendChild(script);
}

function moveSplit(event) {
    if (splitMode && urlFile) {
        var offset = view.right.getBoundingClientRect();
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
function switchMode(keyCode) {
    if (keyCode && keyCode == "16") {
        splitMode = 0;
        var currLeft = (view.left.style.opacity > 0) ? 1 : 0; // current focus
        var switchTo = (currLeft) ? 'right' : 'left'

        infoText.center.innerHTML = getSelValue(select[switchTo], 'folder') + ' '
                                  + infoText[switchTo].innerHTML.replace(/&nbsp;/g, '').replace(/←|→/g, '');

        view.left.style.borderRight = "none";
        view.left.style.opacity = 1 - currLeft;
        view.left.style.width = (offset.width - 1) + "px";
    } else if (!splitMode) {
        view.left.style.borderRight = "1px dotted white";
        view.left.style.opacity = 1;
        view.left.style.width = split.x + "px";
        infoText.center.innerHTML = "--- vs ---";
        splitMode = 1;
    }

    infoText.left.style.opacity = splitMode;
    infoText.right.style.opacity = splitMode;
}

/* Process URL hash for direct links. */
function getWindowsOptions() {
    urlFolder = "comparisonfiles/";
    if (window.location.hash) {
        var hashArr, ampArr, imgOpts, name, scale, leftOpts, rightOpts;

        hashArr = (location.hash).split('#', 3);
        if (hashArr[1]) {
            if (hashArr[1] == "psycomp") {
                urlFolder = "psycomp/";
                preparePsyCompSelects();
                prepareEncodeDesc("psycomp");
            } else if (hashArr[1] == "addpsy") {
                var psyOpt  = new Option("BPG-psy", "bpg");
                psyOpt.setAttribute("folder", 'BPG-psy');
                select.left.insertBefore(psyOpt.cloneNode(true),
                                         select.left.firstChild);
                select.right.insertBefore(psyOpt,
                                         select.right.firstChild);
                select.file.options[27].selected = true;
                select.left.options[1].selected = true;
                select.right.options[0].selected = true;
                leftQual.options[1].selected = true;
                rightQual.options[1].selected = true;
                prepareEncodeDesc("addpsy");
            }
        }

        ampArr = (hashArr.pop()+'&='+'&=').split('&', 5);

        imgOpts = ampArr[0].split('*', 2);
        leftOpts = ampArr[1].split('=', 2);
        rightOpts = ampArr[2].split('=', 2);

        for (var opt, j = 0; opt = select.file.options[j]; j++) {
            if (getSlugName(opt.text) == imgOpts[0]) {
                select.file.selectedIndex = j;
                var z, s, q;

                if (imgOpts[1]) {
                    var z = document.querySelector('#scaleSel [ratio="' + imgOpts[1] + '"]');
                    if (z) {z.selected = true};
                }
                if (urlFolder == "psycomp") { break; }
                if (leftOpts) {
                    s = document.querySelector('#leftSel [value="' + leftOpts[0] + '"]');
                    if (s) {s.selected = true};
                    q = document.querySelector('#leftQual [value="' + leftOpts[1] + '"]');
                    if (q) {q.selected = true};
                    checkWorkers('left');
                }
                if (rightOpts) {
                    s = document.querySelector('#rightSel [value="' + rightOpts[0] + '"]');
                    if (s) {s.selected = true};
                    q = document.querySelector('#rightQual [value="' + rightOpts[1] + '"]');
                    if (q) {q.selected = true};
                    checkWorkers('right');
                }
                break;
            }
        };
    };

    function preparePsyCompSelects() {
        select.left.options.length = 0;
        leftQual.options[2].selected = true;
        leftQual.disabled = true;
        var soft = new Option("BPG-soft", "bpg");
        soft.setAttribute("folder", 'BPG-soft');
        select.left.appendChild(soft);

        select.right.options.length = 0;
        rightQual.options[2].selected = true;
        rightQual.disabled = true;
        var psy  = new Option("BPG-psy", "bpg");
        psy.setAttribute("folder", 'BPG-psy');
        select.right.appendChild(psy);
    }
    function prepareEncodeDesc(comp) {
        var clis, encs;

        clis = getElId("descCli");
        encs = getElId("descEnc");

        if (comp == "psycomp"){
            clis.innerHTML = "";
            encs.innerHTML = "";

            insertText(clis, "BPG-soft: bpgenc-0.9.4 -b 10 -m 9, with x265-1.4+226 --no-cutree --aq-mode 1 --crf");
            insertText(clis, "BPG-psy: [...] --deblock -2:-2 --{cbqpoffs, crqpoffs} -1 --psy-rd 0.8 --psy-rdoq 2.4 --bitrate");

            insertText(encs, "Soft 1st encoded to equivalent of 28 base QP. Psy matched to within +/- 5% filesize.");
            insertText(encs, "Press Shift to flip between individual encodes. Rescaling is through Lanczos2.");
        } else if (comp == "addpsy") {
            insertText(clis, "bpgenc-0.9.4 -b 10 -m 9, with x265-1.4+228 --aq-mode 1 --psy-rd [0.25,0.5,0.75,1] --psy-rdoq [1,1.6,2.2,2.8] --deblock -2:-2 --{cbqpoffs, crqpoffs} -1",
                clis.firstChild);
        }
    }
    function insertText(el, text, pushedBackText) {
        var p = document.createElement("p");
        var textNode = document.createTextNode(String(text));

        p.appendChild(textNode);
        if (pushedBackText) {
            el.insertBefore(p, pushedBackText)
        } else {
            el.appendChild(p);
        }
    }
}

getWindowsOptions();

window.addEventListener("load", function() {
    setFile();
    /*loadScript('randomextras/extras.js', function() {
        var randOpt = new Option("Random", "random");
        var blank = document.createElement("option");
        var optGroup = document.createElement("optgroup");

        blank.disabled = true;
        optGroup.setAttribute("label", 'More?');

        optGroup.appendChild(randOpt);
        select.file.appendChild(blank);
        select.file.appendChild(optGroup);
    });*/
}, false);
window.addEventListener("keydown", function(event) {
    /*if (event.keyCode == "82") {
        if (select.file.options[select.file.selectedIndex].innerHTML.length == 0) {
                select.file.options[select.file.options.length - 1].selected = true;
                setFile();
        }
    }*/
    switchMode(event.keyCode);
}, false);

view.right.addEventListener("mousemove", moveSplit, false);
view.right.addEventListener("click", moveSplit, false);

infoText.right.style.backgroundColor = "rgba(0,0,0,.3)";
infoText.left.style.backgroundColor = "rgba(0,0,0,.3)";
