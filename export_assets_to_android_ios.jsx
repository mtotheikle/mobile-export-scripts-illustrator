$.level = 2; // Supposedly full debug mode  
/**
* Author: austynmahoney (https://github.com/austynmahoney)
*/
var selectedExportOptions = {};

var androidExportOptions = [
    {
        name: "mdpi",
        scaleFactor: 50,
        type: "android"
    },
    {
        name: "hdpi",
        scaleFactor: 75,
        type: "android"
    },
    {
        name: "xhdpi",
        scaleFactor: 100,
        type: "android"
    },
    {
        name: "xxhdpi",
        scaleFactor: 150,
        type: "android"
    },
    {
        name: "xxxhdpi",
        scaleFactor: 200,
        type: "android"
    }
];

var iosExportOptions = [
    {
        name: "",
        scaleFactor: 50,
        type: "ios"
    },
    {
        name: "@2x",
        scaleFactor: 100,
        type: "ios"
    },
    {
        name: "@3x",
        scaleFactor: 150,
        type: "ios"
    }
];

var folder = Folder.selectDialog("Select export directory");
var document = app.activeDocument;
var layerData = new Array();

// Note: only use one character!
var exportLayersStartingWith = "#";
var exportLayersWithArtboardClippingStartingWith = "%";

if(document && folder) {
    var dialog = new Window("dialog","Select export sizes");
    var osGroup = dialog.add("group");

    var androidCheckboxes = createSelectionPanel("Android", androidExportOptions, osGroup);
    var iosCheckboxes = createSelectionPanel("iOS", iosExportOptions, osGroup);

    var buttonGroup = dialog.add("group");
    var okButton = buttonGroup.add("button", undefined, "Export");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel");
    
    okButton.onClick = function() {
        for (var key in selectedExportOptions) {
            if (selectedExportOptions.hasOwnProperty(key)) {
                var item = selectedExportOptions[key];
                exportToFile(item.scaleFactor, item.name, item.type);
            }
        }
        this.parent.parent.close();
    };
    
    cancelButton.onClick = function () {
        this.parent.parent.close();
    };

    dialog.show();
}

function exportToFile(scaleFactor, resIdentifier, os) {
    var i, ab, file, options, expFolder;
    if(os === "android")
        expFolder = new Folder(folder.fsName + "/drawable-" + resIdentifier);
    else if(os === "ios")
        expFolder = new Folder(folder.fsName + "/iOS");

	if (!expFolder.exists) {
		expFolder.create();
	}

    // Finds all layers that should be saved and saves these to the export layers array
    collectLayerData(document, null);

	var layersToExportCount = 0;

	for (var i = 0; i < layerData.length; i++) {
        if ((layerData[i].tag == "include") || (layerData[i].tag == "include_and_clip")) {
 			
            if(os === "android")
            	file = new File(expFolder.fsName + "/" +layerData[i].layerName + ".png");
	        else if(os === "ios")
	            file = new File(expFolder.fsName + "/" + layerData[i].layerName + resIdentifier + ".png");
	        
            // Hide all layers first
            hideAllLayers();
            
            // Now show all layers needed to actually display the current layer on screen
            layerData[i].showIncludingParentAndChildLayers(); //showIncludingParents();

	        var clipToArtboard = false;
	        if (layerData[i].tag == "include_and_clip") {
	            clipToArtboard = true;
	        }

	        options = new ExportOptionsPNG24();
	        options.transparency = true;
	        options.artBoardClipping = clipToArtboard;
	        options.antiAliasing = true;
	        options.verticalScale = scaleFactor;
	        options.horizontalScale = scaleFactor;

	        document.exportFile(file, ExportType.PNG24, options);
		}
	}
};


function hideAllLayers() {

    for (var i = 0; i < layerData.length; i++) {
        layerData[i].hide();
    }
}

// Collects information about the various layers
function collectLayerData(rootLayer, extendedRootLayer) {
    for (var i = 0; i < rootLayer.layers.length; i++) {

        // We never even process locked or hidden layers
        if ((!rootLayer.layers[i].locked) && (rootLayer.layers[i].visible)) {

            var extendedLayer = new ExtendedLayer(rootLayer.layers[i]);

            // Set up parent
            extendedLayer.parentLayer = extendedRootLayer;

            // Also add this layer to the parents child collection
            if (extendedRootLayer != null) {
                extendedRootLayer.childLayers.push(extendedLayer);
            }

            layerData.push(extendedLayer);

            // Tag these layers so that we later can find out if we should export these layers or not
            if (rootLayer.layers[i].name.substring(0, 1) == exportLayersStartingWith) {
                extendedLayer.tag = "include";
            } else if (rootLayer.layers[i].name.substring(0, 1) == exportLayersWithArtboardClippingStartingWith) {
                extendedLayer.tag = "include_and_clip";
            } else {
                extendedLayer.tag = "skip";
            }

            // We should not export this layer but we continue looking for sub layers that might need to be exported
            collectLayerData(rootLayer.layers[i], extendedLayer);
        }
    }
}


// Holds info and additional methods for layers
function ExtendedLayer(layer) {
    this.originalVisibility = layer.visible;
    this.layer = layer;
    this.tag = "";
    this.hide = hide;
    this.show = show;
    this.showIncludingParentAndChildLayers = showIncludingParentAndChildLayers;
    this.restoreVisibility = restoreVisibility;
    this.restoreVisibilityIncludingChildLayers = restoreVisibilityIncludingChildLayers;
    this.layerName = layer.name;

    // Set after creating
    this.childLayers = new Array();
    this.parentLayer = null;

    function hide() {
        layer.visible = false;
    }

    function show() {
        layer.visible = true;
    }

    // Shows this layer including it's parent layers (up to the root) and it's child layers
    function showIncludingParentAndChildLayers() {

        var parentlayerName = "";

        if (this.parentLayer != null) {
            parentlayerName = this.parentLayer.layerName;
        }

        // Show all parents first
        var aParentLayer = this.parentLayer;

        while (aParentLayer != null) {
            aParentLayer.restoreVisibility();

            // Keep looking
            aParentLayer = aParentLayer.parentLayer;
        }

        // Show our own layer finally
        this.restoreVisibilityIncludingChildLayers();
    }

    function restoreVisibility() {
        layer.visible = this.originalVisibility;
    }

    function restoreVisibilityIncludingChildLayers() {
        this.restoreVisibility();

        // Call recursively for each child layer
        for (var i = 0; i < this.childLayers.length; i++) {
            this.childLayers[i].restoreVisibilityIncludingChildLayers();
        }
    }
}

function createSelectionPanel(name, array, parent) {
    var panel = parent.add("panel", undefined, name);
    panel.alignChildren = "left";
    for(var i = 0; i < array.length;  i++) {
        var cb = panel.add("checkbox", undefined, "\u00A0" + array[i].name);
        cb.item = array[i];
        cb.onClick = function() {
            if(this.value) {
                selectedExportOptions[this.item.name] = this.item;
                //alert("added " + this.item.name);
            } else {
                delete selectedExportOptions[this.item.name];
                //alert("deleted " + this.item.name);
            }
        };
    }
};
