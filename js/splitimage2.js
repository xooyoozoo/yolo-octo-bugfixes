(function() {
    var cl = document.getElementById('filesel');
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

var leftsel = document.getElementById('leftsel');
var rightsel = document.getElementById('rightsel');
var filesel = document.getElementById('filesel');
var left = document.getElementById('leftcontainer');
var right = document.getElementById('rightcontainer');
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
var lefttext = document.getElementById('lefttext');
var righttext = document.getElementById('righttext');
var urlfile;
var stick = 0;
var timer;
var textheight = lefttext.offsetHeight;
var first = 1;

leftsel.onchange = function() {
    set_left();
};
leftqual.onchange = function() {
    set_left();
};
rightsel.onchange = function() {
    set_right();
};
rightqual.onchange = function() {
    set_right();
};
filesel.onchange = function() {
    set_file();
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
            lefttext.style.right = (offset.width - splitx) + "px";
            lefttext.style.bottom = (offset.height - splity) + "px";
            righttext.style.left = (splitx + 1) + "px";
            righttext.style.bottom = (offset.height - splity) + "px";

            if (splitx == splitx_target && splity == splity_target) {
                clearInterval(timer);
                timer = null;
            }
        }, 20);
    }
}

function setImage(container, name, codec, side) {
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

        if (side == "right") {
            righttext.innerHTML = "&rarr;&nbsp;" + kbytes;
        } else if (side == "left") {
            lefttext.innerHTML = kbytes + "&nbsp;&larr;";
            textheight = lefttext.offsetHeight;
        };
    };
    xhr.send();
}

function set_left() {
    var quality = '';
    var image = leftsel.options[leftsel.selectedIndex].getAttribute("value");
    var name = leftsel.options[leftsel.selectedIndex].innerHTML;

    if (name != 'Original') {
        quality = leftqual.options[leftqual.selectedIndex].innerHTML.toLowerCase() + '/';
    }
    name = quality + name;

    setImage(left, name, image, 'left');
}

function set_right() {
    var quality = '';
    var image = rightsel.options[rightsel.selectedIndex].getAttribute("value");
    var name = rightsel.options[rightsel.selectedIndex].innerHTML;

    if (name != 'Original') {
        quality = rightqual.options[rightqual.selectedIndex].innerHTML.toLowerCase() + '/';
    }
    name = quality + name;

    setImage(right, name, image, 'right');
}

function set_file() {
    urlfile = filesel.options[filesel.selectedIndex].getAttribute("value");
    first = 1;
    set_right();
    set_left();
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
        righttext.style.backgroundColor = "rgba(0,0,0,.4)";
        lefttext.style.backgroundColor = "rgba(0,0,0,.4)";
        movesplit(event);
    } else {
        righttext.style.backgroundColor = "rgba(0,0,0,0)";
        lefttext.style.backgroundColor = "rgba(0,0,0,0)";
    }
}

set_file();

setSplit();
right.addEventListener("mousemove", movesplit, false);
right.addEventListener("click", movesplit, false);
righttext.style.backgroundColor = "rgba(0,0,0,.3)";
lefttext.style.backgroundColor = "rgba(0,0,0,.3)";
