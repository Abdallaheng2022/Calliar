/*
variables
*/

var canvas;
var mousePressed = false;
var curr_img;
var currStroke = "";
var currSketch = [];
var currStrokeSimplified = "";

var allPaths = [];
const colors = ['black', 'red', 'blue', 'green', 'orange', 'brown', 'purple']
var oldImageName;
var newImageName;
var numImages;
var procNumImages;
var readonlyInput;
var input;
var ctr = 0; 
var paper; 
var strokeWidth = 3;
var currImageId = 0;
var imageBlob;
var existOnServer = true;
var blob;

function addRaster(url)
{
    if (url==undefined){
        alert('no more images to draw or something went wrong, going to home page')
        if (window.location.pathname !='/'){
          //window.location='/'
          //window.location.reload()
        }

    }
    var raster;

    if (existOnServer){
        raster = new paper.Raster({source: "/media/calliar_images/images/"+url})
    }else{
        raster = new paper.Raster({source: url})
    }
    
    var w, h;
    raster.onLoad = function ()
    {
        raster.opacity = 0.3
        h = raster.width;
        w = raster.height;

        const scale = 600;
        if (w > h){
            h = parseInt((h/w) * scale);
            w = scale;
        }else{
            w = parseInt((w/h) * scale);
            h = scale; 
        }
        raster.fitBounds(paper.view.bounds)
        curr_img = raster.image
    };

}

function addImage(imageName)
{
    addRaster(imageName)
    var text =((imageName).split('.')[0]).trim()
    newImageName = text+'.jpg'
    input.value  = text;
    text = preprocess(text)[1]
    readonlyInput.value  = text;
}
/*
load the model
*/

function getImageUrl(){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", '/endpoint/next-image?id='+currImageId, false ); // false for synchronous request
    xmlHttp.send( null );
    response = JSON.parse(xmlHttp.response)
    numImages = response.num_images
    procNumImages = response.proc_num_images
    document.getElementById("ctr").innerHTML = 'You processed '+ctr+ ', remaining images '+numImages+', total processed images '+procNumImages;
    currImageId = parseInt(response.id)
    return response.image_path
}

async function start() {

    var slider = document.getElementById('myRange');
    readonlyInput = document.getElementById("text-readonly");
    input = document.getElementById("text");
    paper.install(window);
    paper.setup('canvas');

    // Create a simple drawing tool:
    var tool = new Tool();
    var path;

    // Define a mousedown and mousedrag handler
    tool.onMouseDown = function(event) {
        // If we produced a path before, deselect it:
        if (path) {
            path.selected = false;
        }
        
        path = new Path({
            segments: [event.point],
            strokeColor: colors[currSketch.length % colors.length],
            strokeWidth: strokeWidth,
            fullySelected: true
        });
        
    }

    tool.onMouseDrag = function(event) {
        path.add(event.point);
    }


    tool.onMouseUp = function(event) {            
        currStroke = getPoints(path)
        
        if (path.segments.length > 5){ //only simplify if the length is greater than 5
            path.simplify();
        }
        else{
            //if the length is less add a single point
            prev_point_index = path.segments.length - 1
            prev_point = path.segments[prev_point_index].point;
            path.add(prev_point.add(1))
        }
        currStroke = getPoints(path);
            
        path.fullySelected = true;
        currStrokeSimplified = path.exportSVG().getAttribute("d")

        const currChar = readonlyInput.value.charAt(currSketch.length * 2)
        if (currChar == "")
        {
            path.remove();
            alert("cannot add empty characters!")
        }
        else{
            currSketch.push({[currChar]:[currStroke, currStrokeSimplified]})
            allPaths.push(path)
            readonlyInput.focus();
            readonlyInput.setSelectionRange(0, currSketch.length * 2);

        }

    }

    tool.onKeyDown = function(event) { 
        if(event.key == 'right'){
            getNext()
        }
        if (event.key == 'left') {
            getPrev()
        }
    }

    next()

    slider.onchange  = function() {
        strokeWidth = parseInt(this.value);
    };



    $(input).change(function(e){
        text = input.value.trim()
        newImageName = text+'.jpg'
        text = preprocess(text)[1]
        readonlyInput.value  = text;
    })

    
}

function undo() {
    const lastStrokeIdx = allPaths.length - 1;
    if (allPaths.length >= 1){
        allPaths[lastStrokeIdx].remove();
        currSketch.splice(-1, 1)
        currSketch.currStrokeSimplified.splice(-1, 1)
        allPaths.splice(-1, 1)
    }
    // update selection
    readonlyInput.focus();
    readonlyInput.setSelectionRange(0, currSketch.length * 2);
        
}

function save() {
    if(currSketch.length != readonlyInput.value.split(" ").length)
    {
        console.log(readonlyInput.value.split(" "))
        console.log(currSketch)
        alert('sketch size is not the same as the text chars!')
        return 
    }
    var xhr = new XMLHttpRequest();
    xhr.open("POST", '/endpoint/', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
        sketch: currSketch,
        oldImageName:oldImageName,
        newImageName:newImageName,
        existOnServer:existOnServer,
        imageBlob:imageBlob,
    }));
    const response = JSON.parse(xhr.response)

    if (response.result == true)
    {
        next()
        ctr += 1;
        document.getElementById("ctr").innerHTML = 'You processed '+ctr+ ', remaining images '+numImages+', total processed images '+procNumImages;
    }
    else{
        alert('server refused to save image')
    }
    currStroke = []
    currSketch = []
    currStrokeSimplified = []
}

function clearCanvas()
{
    paper.project.activeLayer.removeChildren();
    currStroke = []
    currSketch = []
    currStrokeSimplified = []
    allPaths  = []
}
function next() {
    clearCanvas();
    existOnServer = true
    oldImageName = getImageUrl()
    console.log(oldImageName)
    addImage(oldImageName)
}

/*
clear the canvas 
*/
function erase() {
    clearCanvas();
    if(existOnServer)
        addRaster(oldImageName);
    else
        addRaster(blob)

}

function getNext(){
    currImageId += 1
    next()
}

function getPrev(){
    currImageId -= 1
    next()
}

function loadImage(event) {
    imageName = event.target.files[0]['name']
    blob = URL.createObjectURL(event.target.files[0]);
    clearCanvas();
    existOnServer = false
    addRaster(blob)
    var reader = new FileReader();
    reader.readAsDataURL(event.target.files[0]); 
    reader.onloadend = function() {
        var base64data = reader.result;
        imageBlob = base64data
    }

    var text =((imageName).split('.')[0]).trim()
    newImageName = text+'.jpg'
    input.value  = text;
    text = preprocess(text)[1]
    readonlyInput.value  = text;
}
function clearImage() {
    document.getElementById('formFile').value = null;
    frame.src = "";
}
