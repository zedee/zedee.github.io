'use strict';

window.onload = (ev) => {
  /**
   * Handlers Section 
   */

  //Handler for the canvas operations
  const handleCanvasClick = (ev) => {
    //Get absolute position respect to canvas
    const x = ev.clientX - mainCanvas.canvasElement.offsetLeft;
    const y = ev.clientY - mainCanvas.canvasElement.offsetTop;

    //Find the cell which has been clicked onto
    const foundCoordinates = findCellCoordinatesInGrid(mainCanvas.grid, x, y);

    if (foundCoordinates.rowIndex >= 0) {
      //Paint the found pixel (pencil tool)
      if (mainCanvas.selectedTool == "pencil") {
        mainCanvas.grid[foundCoordinates.rowIndex][foundCoordinates.cellIndex].fillColor = 
          mainCanvas.selectedColor;
        mainCanvas.drawGrid();
      //Fill the area with the selected color (bucket tool)
      } else if (mainCanvas.selectedTool == "bucket") {
        floodFillArea(
          foundCoordinates.rowIndex, 
          foundCoordinates.cellIndex,
          mainCanvas.grid[foundCoordinates.rowIndex][foundCoordinates.cellIndex].fillColor,
          mainCanvas.selectedColor,
          mainCanvas.grid
        );
        //Repaint grid
        mainCanvas.drawGrid();        
      }
    }
  }

  //Set the brush/bucket color
  const handlePaletteColorChange = (ev) => {
    mainCanvas.selectedColor = ev.detail.color;
  }

  //When window resizes, readapt and redraw everything
  const handleWindowResize = () => {
    //TODO: set wrapper w/h, as with some sizes this comes a bit unbereable to use
    mainCanvas.width = document.querySelector("#wrapper").offsetWidth;
    mainCanvas.height = document.querySelector("#wrapper").offsetWidth;
    mainCanvas.canvasElement.width = document.querySelector("#wrapper").offsetWidth;
    mainCanvas.canvasElement.height = document.querySelector("#wrapper").offsetWidth;
    mainCanvas.updateGrid();
    mainCanvas.drawGrid();
  }

  //Grid resolution size change
  const handleGridSize = (ev) => {    
    let resizeGrid = false;
    const oldGridSize = mainCanvas.gridSize;
    if (mainCanvas.gridSize != ev.target.dataset.gridSize) {      
      mainCanvas.gridSize = ev.target.dataset.gridSize;
      resizeGrid = mainCanvas.updateGrid(true);
      if (resizeGrid) {
        switchActiveElement(gridControls, ev.target);
      } else {
        mainCanvas.gridSize = oldGridSize;
      }
      mainCanvas.drawGrid();
    }
  }

  //Tool selection
  const handleToolSelection = (ev) => {    
    //Check if user wants to clear
    if (ev.target.dataset.tool == "clear") {
      mainCanvas.clearGrid();
    } else {
      mainCanvas.selectedTool = ev.target.dataset.tool;
      switchActiveElement(toolControls, ev.target);
    }
  }

  //Export selection
  const handleExportImageSelection = (ev) => {
    //Image Export data URL container
    let imageExport;

    //Create a canvas buffer and redraw it for export purposes (no grid visible)
    const mainCanvasBuffer = createCanvasExportBuffer(mainCanvas);

    switch (ev.target.dataset.export) {
      case "png":
        imageExport = mainCanvasBuffer.toDataURL("image/png");        
        break;
      case "jpg":
        imageExport = mainCanvasBuffer.toDataURL("image/jpeg");
        break;
      case "gif":
        imageExport = mainCanvasBuffer.toDataURL("image/gif");
        break;
    }
    ev.target.parentNode.href = imageExport;
  }

  /**
   * Init point
   */
  
  //Init palette and main drawing canvas  
  const mainCanvas = new MainCanvas("#main-canvas", 8);
  const palette = createPalette("#row-palette", mainCanvas.selectedColor);
  const gridControls = document.querySelectorAll("#col-controls-size-select button");
  const toolControls = document.querySelectorAll("#col-controls-tool-select button");
  const exportControls = document.querySelectorAll("#col-controls-export-select button");

  //Add eventListeners to our elements
  mainCanvas.canvasElement.addEventListener("click", handleCanvasClick, false);  
  palette.addEventListener("colorChange", handlePaletteColorChange, false);
  gridControls.forEach(element => {
    element.addEventListener("click", handleGridSize, false);
  });
  toolControls.forEach(element => {
    element.addEventListener("click", handleToolSelection, false);
  });
  exportControls.forEach(element => {
    element.addEventListener("click", handleExportImageSelection, false);
  });
  //TODO: handle scaling correctly
  window.addEventListener("resize", handleWindowResize, false);   

  //Set default selected tools
  switchActiveElement(toolControls, document.querySelector("#col-controls-tool-select button:first-child"));
  switchActiveElement(gridControls, document.querySelector("#col-controls-size-select button:first-child"));
}

/**
 * Main canvas object
 * @param {*} domElementId 
 * @param {*} gridSize 
 */
function MainCanvas (domElementId, gridSize) {
  this.domElementId = domElementId || "#canvas";
  this.canvasElement = document.querySelector(this.domElementId);
  this.context = this.canvasElement.getContext('2d');
  this.gridSize = gridSize || 8;
  this.width = document.querySelector("#wrapper").offsetWidth;
  this.height = document.querySelector("#wrapper").offsetWidth;
  this.gridBorderColor = "#000000";
  this.grid = [];
  this.selectedColor = "#000000";
  this.selectedTool = "pencil";

  this.init = function() {
    this.canvasElement.width = this.width;
    this.canvasElement.height = this.height;

    this.createGrid = function(drawCallback) {
      for (let i = 0; i < this.gridSize; i++) {
        this.grid.push([]);
        for (let j = 0; j < this.gridSize; j++) {
          this.grid[i].push(new Cell(
            this.width / this.gridSize, 
            this.width / this.gridSize,
            ((this.width / this.gridSize * j) % this.width),
            ((this.width / this.gridSize * i) % this.width)
          ));
        }
      }
      drawCallback();
    }

    //Scaling function when window is resized
    this.updateGrid = function(resizeDensity) {
      if (resizeDensity) {
        /*
         * By now, let's just erase the current drawing. While it'd possible 
         * to save and set the already drawn pixels if the user wants to 
         * upscale the resolution (via matrix transpose for instance),
         * it'd be a bit more complex to go the other way (downscaling), as 
         * some kind of interpolation should be done in order to keep the most
         * significant information after decreasing the density. This is not
         * a requirement, so i'll keep the most simple implementation.
         */
        const userAcceptsDelete = 
          confirm("Warning, changing the grid density will erase the current drawing, are you sure?");
        if (userAcceptsDelete) {
          this.clearGrid();          
          return userAcceptsDelete;
        }
      } else {
        this.grid.forEach((row, rowIndex) => {
          row.forEach((cell, cellIndex) => {
            cell.width = this.width / this.gridSize; 
            cell.height = this.width / this.gridSize;
            cell.posX = ((this.width / this.gridSize * (cellIndex % this.gridSize)) % this.width);
            cell.posY = ((this.width / this.gridSize * rowIndex)) % this.width;
          });
        });
      }
    }

    //Grid (re)draw function
    this.drawGrid = (disableGrid) => this.grid.forEach(row => {
      row.forEach(cell => {
        this.context.fillStyle = cell.fillColor;
        this.context.strokeStyle = this.gridBorderColor;
        if (!disableGrid) {
          this.context.strokeRect(cell.posX, cell.posY, cell.width, cell.width);
        }        
        this.context.fillRect(cell.posX, cell.posY, cell.width, cell.width);
      });
    });

    //Clears the grid
    this.clearGrid = () => {
      this.grid = [];
      this.createGrid(this.drawGrid);
    }

    this.createGrid(this.drawGrid);
  }

  this.init();
}

//We assume it's a square cell
function Cell (width, height, posX, posY, fillColor) {
  this.width = width || 0;
  this.posX = posX || 0;
  this.posY = posY || 0;
  this.fillColor = fillColor || "#FFF";
}

/**
 * Create and attach a palette to the DOM
 * @param {*} targetElementId 
 * @returns 
 */
function createPalette (targetElementId, defaultColorSelected) {
  const colorPalette = {
    default: [
      "#0C46FA",
      "#0BD9C6",
      "#00F001",
      "#FFF600",
      "#FCA70D",
      "#F50076",
      "#5D00E5",
      "#0D79FD",      
      "#FFFFFF",
      "#808080",
      "#000000"
    ]
  };

  const paletteWrapperElement = document.querySelector(targetElementId);
  
  //Color change handler
  const handleColorChange = (ev) => {
    const allColorsSelector = document.querySelectorAll(".palette-color");

    //Remove all 'selected' classes
    allColorsSelector.forEach(colorElement => {
      colorElement.className = "palette-color";
    });
    //Add 'selected' class to the selected color
    ev.target.className = "palette-color" + " selected";

    const event = new CustomEvent("colorChange", {
      detail: {
        color: ev.target.dataset.color
      }      
    });
    paletteWrapperElement.dispatchEvent(event);
  }

  //Create palette element
  for (let i = 0; i < colorPalette.default.length; i++) {
    const paletteColor = document.createElement('div');
    const paletteColorSelected = document.createElement('span');
    paletteColorSelected.className = "selection-check";
    paletteColorSelected.textContent = "\u2022";
    paletteColor.appendChild(paletteColorSelected);
    //Set default color selected
    paletteColor.className = colorPalette.default[i] == defaultColorSelected ? 
      "palette-color selected" : "palette-color";
    paletteColor.dataset.color = colorPalette.default[i];
    paletteColor.style.backgroundColor = colorPalette.default[i];
    paletteColor.addEventListener("click", handleColorChange, false);
    paletteWrapperElement.appendChild(paletteColor);    
  }

  return paletteWrapperElement;
}

//Switch active element (marks it in red)
function switchActiveElement(DOMSelector, eventTarget) {
  DOMSelector.forEach(element => {
    element.style.color = "black";
    element.style.fontWeight = "normal";
  });
  eventTarget.style.color = "#2196f3";
  eventTarget.style.fontWeight = "bold";
}

//Finds a cell into the grid
function findCellCoordinatesInGrid(grid, x, y) {
  let foundCellIndex = -1;
  let foundCoordinates = { rowIndex: -1, cellIndex: -1 };

  for (let i = 0; i < grid.length; i++) {
    foundCellIndex = grid[i].findIndex(cell => isInBoundaries(cell, x, y));
    if (foundCellIndex != -1) {
      foundCoordinates.rowIndex = i;
      foundCoordinates.cellIndex = foundCellIndex;
      return foundCoordinates;
    }
  }

  return foundCoordinates;
}

//Check if a selected x, y screen point is in boundaries
function isInBoundaries(cell, x, y) {
  //posX - 1 and posY - 1 is a bias to compensate and prevent "false" clicks if the user clicks on the grid border
  return (x < (cell.posX + cell.width) && y < (cell.posY + cell.width) && x > cell.posX - 1 && y > cell.posY - 1);
}

/**
 * Going with Simple 4 way iterative method
 * Bit inefficient but works for our purposes
 * https://en.wikipedia.org/wiki/Flood_fill  [Stack-based recursive implementation (four-way)]
 */
 function floodFillArea(x, y, oldColor, newColor, canvasGrid) {
  let pixelStack = [];
  pixelStack.push([x, y]);

  while(pixelStack.length > 0) {
    //Assign values from the array to vars x and y
    let [x, y] = pixelStack.pop();

    //Check if valid boundaries
    if (x < 0 || x > canvasGrid.length - 1 || y < 0 || y > canvasGrid[x].length - 1) {
      continue;
    }
    
    if (canvasGrid[x][y].fillColor !== oldColor || canvasGrid[x][y].fillColor == newColor) {
      continue;
    }

    //Apply the new color
    canvasGrid[x][y].fillColor = newColor;

    //Push the neighbors in 4 directions
    pixelStack.push([x + 1, y]);
    pixelStack.push([x - 1, y]);
    pixelStack.push([x, y + 1]);
    pixelStack.push([x, y - 1]);
  }
 }

//Creates a buffer of the current canvas without the gridlines for exporting or preview purposes
function createCanvasExportBuffer(originCanvas) {
    const mainCanvasBuffer = document.createElement('canvas');
    mainCanvasBuffer.width = originCanvas.width;
    mainCanvasBuffer.height = originCanvas.height;
    const mainCanvasBufferContext = mainCanvasBuffer.getContext('2d');
    mainCanvasBuffer.style.display = "none";    
    originCanvas.drawGrid(true); //Set up disable grid on canvas
    const imgData = originCanvas.context.getImageData(0, 0, originCanvas.width, originCanvas.height);
    originCanvas.drawGrid(false); //Set up disable grid on canvas
    mainCanvasBufferContext.putImageData(imgData, 0, 0);

    return mainCanvasBuffer;
}