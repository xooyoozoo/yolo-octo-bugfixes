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

var leftSel = elId('leftSel');
var rightSel = elId('rightSel');
var filesel = elId('filesel');
var left = elId('leftContainer');
var right = elId('rightContainer');

var viewOptions = [
    '', /* file */
    '', /* left-image */
    '', /* left-quality */
    '', /* right-image */
    ''  /* right-quality */
];

var offset = {
    width: right.getBoundingClientRect().width,
    height: right.getBoundingClientRect().height
};
var splitx = offset.width * .5;
var splity = offset.height * .5;
var splitx_target = splitx;
var splity_target = splity;
var splitx1 = 0;
var splity1 = 0;
var leftText = elId('leftText');
var rightText = elId('rightText');
var urlfile;
var stick = 0;
var timer;
var textheight = leftText.offsetHeight;
var first = 1;

leftSel.onchange = function() {
    setLeft();
};
leftQual.onchange = function() {
    setLeft();
};
rightSel.onchange = function() {
    setRight();
};
rightQual.onchange = function() {
    setRight();
};
filesel.onchange = function() {
    setFile();
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
    if (el == right) {
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

            left.style.width = splitx + "px";
            leftText.style.right = (offset.width - splitx) + "px";
            leftText.style.bottom = (offset.height - splity) + "px";
            rightText.style.left = (splitx + 1) + "px";
            rightText.style.bottom = (offset.height - splity) + "px";

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

    var path = 'comparisonfiles/'.concat(name, '/', urlfile, '.', codec);
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
                    var decoder = new WebPDecoder();

                    var config = decoder.WebPDecoderConfig;
                    var output_buffer = config.output;
                    var status = decoder.WebPGetFeatures(int_data, int_data.length, config.input);

                    output_buffer.colorspace = decoder.WEBP_CSP_MODE.MODE_ARGB;
                    status = decoder.WebPDecode(int_data, int_data.length, config);

                    var bitmap = output_buffer.u.RGBA.rgba;
                    var biWidth = output_buffer.width;
                    var biHeight = output_buffer.height;
                    if (!bitmap) {
                        return false;
                    }

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
                } else if (codec == 'jp2') {
                    jp2kWorker.onmessage = function(event) {
                        var bitmap = event.data;
                        var pixelsPerChannel = bitmap.width * bitmap.height;
                        if (!bitmap) {
                            return false;
                        }

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

function setLeft() {
    var image = leftSel.options[leftSel.selectedIndex].getAttribute("value");
    var name = leftSel.options[leftSel.selectedIndex].innerHTML;

    if (name != 'Original') {
        leftQual.disabled=false;
        var quality = leftQual.options[leftQual.selectedIndex].innerHTML.toLowerCase() + '/';
    } else {
        leftQual.disabled=true;
        var quality = '';
    }

    name = quality + name;
    viewOptions[1] = image;
    viewOptions[2] = leftQual.options[leftQual.selectedIndex].getAttribute("value");

    setImage(left, name, image, function(kbytes) {leftText.innerHTML = kbytes + "&nbsp;&larr;";
                                                  textheight = leftText.offsetHeight;});
    window.location.hash = viewOptions[0].concat('&',viewOptions[1],'=',viewOptions[2],
                                                 '&',viewOptions[3],'=',viewOptions[4]);
}

function setRight() {
    var image = rightSel.options[rightSel.selectedIndex].getAttribute("value");
    var name = rightSel.options[rightSel.selectedIndex].innerHTML;

    if (name != 'Original') {
        rightQual.disabled=false;
        quality = rightQual.options[rightQual.selectedIndex].innerHTML.toLowerCase() + '/';
    } else {
        rightQual.disabled=true;
        var quality = '';
    }

    name = quality + name;
    viewOptions[3] = image;
    viewOptions[4] = rightQual.options[rightQual.selectedIndex].getAttribute("value");

    setImage(right, name, image, function(kbytes) {rightText.innerHTML = "&rarr;&nbsp;" + kbytes;});
    window.location.hash = viewOptions[0].concat('&',viewOptions[1],'=',viewOptions[2],
                                                 '&',viewOptions[3],'=',viewOptions[4]);
}

function setFile() {
    urlfile = filesel.options[filesel.selectedIndex].getAttribute("value");

    first = 1;
    viewOptions[0] = slug(filesel.options[filesel.selectedIndex].text);

    setRight();
    setLeft();
}

function movesplit(event) {
    if (!stick) {
        var offset = right.getBoundingClientRect();
        splitx_target = event.clientX - offset.left;
        splity_target = event.clientY - offset.top;
        if (splitx_target < 0) splitx_target = 0;
        if (splity_target < textheight) splity_target = textheight;
        if (splitx_target >= offset.width) splitx_target = offset.width - 1;
        if (splity_target >= offset.height) splity_target = offset.height - 1;
        setSplit();
    }
    return false;
}

function sticksplit(event) {
    stick = !stick;
    if (!stick) {
        rightText.style.backgroundColor = "rgba(0,0,0,.4)";
        leftText.style.backgroundColor = "rgba(0,0,0,.4)";
        movesplit(event);
    } else {
        rightText.style.backgroundColor = "rgba(0,0,0,0)";
        leftText.style.backgroundColor = "rgba(0,0,0,0)";
    }
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
setFile();

setSplit();
right.addEventListener("mousemove", movesplit, false);
right.addEventListener("click", movesplit, false);
rightText.style.backgroundColor = "rgba(0,0,0,.3)";
leftText.style.backgroundColor = "rgba(0,0,0,.3)";
