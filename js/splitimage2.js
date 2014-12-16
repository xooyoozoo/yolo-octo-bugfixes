(function() {
    var cl = elId('filesel');
    var clTexts = new Array();

    for (i = 0; i < cl.length; i++) {
        clTexts[i] =
            cl.options[i].text.toUpperCase() + "|=" +
            cl.options[i].text + "|=" +
            cl.options[i].value + "|=" +
            cl.options[i].selected;
    }
    clTexts.sort();

    for (i = 0; i < cl.length; i++) {
        var parts = clTexts[i].split('|=');

        cl.options[i].text = parts[1];
        cl.options[i].value = parts[2];
        if (parts[3] == "true") {
            cl.options[i].selected = true;
        } else {
            cl.options[i].selected = false;
        }
    }
})(); // Dynamically alphabetize file selection list

var webpWorker = null;
(function() {
    var WebP = new Image();
    WebP.onload = WebP.onerror = function() {
        if (WebP.height != 2) {
            webpWorker = new Worker('js/webpjs-0.0.2.worker.js');
            /*var sc = document.createElement('script');
            sc.type = 'text/javascript';
            sc.async = true;
            var s = document.head || document.getElementsByTagName('head')[0];
            sc.src = 'js/webpjs-0.0.2.min.js';
            s.insertBefore(sc, s.firstChild);*/
        }
    };
    WebP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
})();

var jp2kWorker = null;
(function() {
    var jp2k = new Image();
    jp2k.onerror = jp2k.load = function() {
        if (!jp2k.width || jp2k.width === 0) {
            jp2kWorker = new Worker('js/openjpeg.js');
        }
    };
    jp2k.src = 'data:image/jp2;base64,AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAABAAAAAQAAw8HAAAAAAAPY29scgEAAAAAABAAAABpanAyY/9P/1EALwAAAAAABAAAAAQAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAAAAAw8BAQ8BAQ8BAf9SAAwAAAABAQAEBAAB/1wABECA/5AACgAAAAAAGAAB/5PP/BAQFABcr4CA/9k=';
})();

function elId(id) {
    return document.getElementById(id);
}

var filesel = elId('filesel');
var whichSel = [elId('leftSel'), elId('rightSel')];
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
var splitx = offset.width * .5;
var splity = offset.height * .5;
var splitx_target = splitx;
var splity_target = splity;
var splitx1 = 0;
var splity1 = 0;

var whichText = [elId('leftText'), elId('rightText')];
var urlFile;
var timer;
var textHeight = whichText[0].offsetHeight;
var first = 1;

filesel.onchange = function() {
    setFile();
};
whichSel[0].onchange = function() {
    setSide('left');
};
whichSel[1].onchange = function() {
    setSide('right');
};
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

function setSize(src, width, height, el) {
    el.style.width = width + "px";
    el.style.height = height + "px";
    el.style.backgroundImage = 'url(\"' + src + '\")';
    if (el == whichSide[1]) {
        offset = {
            width: width,
            height: height
        };
        if (first) {
            splitx = splitx_target = width * .5;
            splity = splity_target = height * .5;
            first = 0;
        }
    }
    setSplit();
}

function setSplit() {
    if (!timer) {
        timer = setInterval(function() {
            splitx1 *= .5;
            splity1 *= .5;
            splitx1 += (splitx_target - splitx) * .1;
            splity1 += (splity_target - splity) * .1;

            splitx += splitx1;
            splity += splity1;

            if (Math.abs(splitx - splitx_target) < .5)
                splitx = splitx_target;
            if (Math.abs(splity - splity_target) < .5)
                splity = splity_target;

            whichSide[0].style.width = splitx + "px";
            whichText[0].style.right = (offset.width - splitx) + "px";
            whichText[0].style.bottom = (offset.height - splity) + "px";
            whichText[1].style.left = (splitx + 1) + "px";
            whichText[1].style.bottom = (offset.height - splity) + "px";

            if (splitx == splitx_target && splity == splity_target) {
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
                setSize(canvas.toDataURL(), canvas.width, canvas.height, container);
            };
            image.load(blob_path);
        } else {
            var image = new Image();

            image.onload = function() {
                setSize(image.src, image.width, image.height, container)
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
                        setSize(canvas.toDataURL("image/png"), canvas.width, canvas.height, container);
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
                        setSize(canvas.toDataURL("image/png"), canvas.width, canvas.height, container);
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

        setText(kbytes);
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
    urlFile = filesel.options[filesel.selectedIndex].getAttribute("value");

    first = 1;
    viewOptions[0] = slug(filesel.options[filesel.selectedIndex].text);

    setSide('right');
    setSide('left');
}

function movesplit(event) {
    if (urlFile) {
        var offset = whichSide[1].getBoundingClientRect();
        splitx_target = event.clientX - offset.left;
        splity_target = event.clientY - offset.top;
        if (splitx_target < 0) splitx_target = 0;
        if (splity_target < textHeight) splity_target = textHeight;
        if (splitx_target >= offset.width) splitx_target = offset.width - 1;
        if (splity_target >= offset.height) splity_target = offset.height - 1;
        setSplit();
    }
    return false;
}

function getWindowsOptions() {
    if (window.location.hash) {
        var hashArray = (location.hash+'&='+'&=').split('&', 5);
        var leftOpts = hashArray[1].split('=', 2);
        var rightOpts = hashArray[2].split('=', 2);
        var imageSet = filesel.options;
        for (var opt, j = 0; opt = imageSet[j]; j++) {
            if (slug(opt.text) == hashArray[0].substring(1)) {
                filesel.selectedIndex = j;
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

whichSide[1].addEventListener("mousemove", movesplit, false);
whichSide[1].addEventListener("click", movesplit, false);
whichText[1].style.backgroundColor = "rgba(0,0,0,.3)";
whichText[0].style.backgroundColor = "rgba(0,0,0,.3)";
