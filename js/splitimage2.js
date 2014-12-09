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
rightsel.onchange = function() {
    set_right();
};
filesel.onchange = function() {
    set_file();
};

function set_size(src, width, height, el) {
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
    set_split();
}

function set_split() {
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

function set_image(container, name, codec) {
    container.style.background = "gray";
    container.style.backgroundImage = "";

    if (codec == '.bpg') {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var image = new BPGDecoder(ctx);
        image.onload = function() {
            canvas.width = this.imageData.width;
            canvas.height = this.imageData.height;
            ctx.putImageData(this.imageData, 0, 0);
            set_size(canvas.toDataURL(), canvas.width, canvas.height, container);
        };
        image.load('comparisonfiles/' + name + '/' + urlfile + codec);
    } else if (codec == '.webp') {

        var xhr = new XMLHttpRequest();
        xhr.open("GET", 'comparisonfiles/' + name + '/' + urlfile + codec, true);
        xhr.responseType = "arraybuffer";

        xhr.onload = function(event) {
            var canvas = document.createElement("canvas");
            var ctx = canvas.getContext("2d");

            var response = xhr.response;
            var data = new Uint8Array(response);
            var decoder = new WebPDecoder();

            var config = decoder.WebPDecoderConfig;
            var output_buffer = config.output;
            var bitstream = config.input;
            var StatusCode = decoder.VP8StatusCode;

            status = decoder.WebPGetFeatures(data, data.length, bitstream);

            var mode = decoder.WEBP_CSP_MODE;
            console.log(mode)
            output_buffer.colorspace = mode.MODE_ARGB;

            status = decoder.WebPDecode(data, data.length, config);
            var bitmap = output_buffer.u.RGBA.rgba;

            var biHeight = output_buffer.height;
            var biWidth = output_buffer.width;

            canvas.height = biHeight;
            canvas.width = biWidth;
            var output = ctx.createImageData(canvas.width, canvas.height);
            var outputData = output.data;

            for (var h = 0; h < biHeight; h++) {
                for (var w = 0; w < biWidth; w++) {
                    outputData[0 + w * 4 + (biWidth * 4) * h] = bitmap[1 + w * 4 + (biWidth * 4) * h];
                    outputData[1 + w * 4 + (biWidth * 4) * h] = bitmap[2 + w * 4 + (biWidth * 4) * h];
                    outputData[2 + w * 4 + (biWidth * 4) * h] = bitmap[3 + w * 4 + (biWidth * 4) * h];
                    outputData[3 + w * 4 + (biWidth * 4) * h] = bitmap[0 + w * 4 + (biWidth * 4) * h];

                };
            }

            ctx.putImageData(output, 0, 0);
            set_size(canvas.toDataURL("image/png"), canvas.width, canvas.height, container);

        };
        xhr.send();
    } else {
        var image = new Image();
        image.onload = function() {
            set_size(image.src, image.width, image.height, container)
        };
        image.src = 'comparisonfiles/' + name + '/' + urlfile + codec;
    }
}

function set_left() {
    var image = leftsel.options[leftsel.selectedIndex].getAttribute("value");
    var name = leftsel.options[leftsel.selectedIndex].innerHTML;
    set_image(left, name, image);
    lefttext.innerHTML = name + "&nbsp;&larr;";
    textheight = lefttext.offsetHeight;
}

function set_right() {
    var image = rightsel.options[rightsel.selectedIndex].getAttribute("value");
    var name = rightsel.options[rightsel.selectedIndex].innerHTML
    set_image(right, name, image);
    righttext.innerHTML = "&rarr;&nbsp;" + name;
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
        set_split();
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

set_split();
right.addEventListener("mousemove", movesplit, false);
right.addEventListener("touchstart", movesplit, false);
right.addEventListener("touchmove", movesplit, false);
right.addEventListener("click", sticksplit, false);
righttext.style.backgroundColor = "rgba(0,0,0,.3)";
lefttext.style.backgroundColor = "rgba(0,0,0,.3)";
