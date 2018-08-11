pointRadius = 0.01; // of total size
strokeWidth = 0.005;  // of total size
tickTime = 500; // ms

function pointToCoords(pt){
	var x = parseFloat(pt.getAttribute("cx"));
	var y = parseFloat(pt.getAttribute("cy"));
	return {x, y};
}

class Vector {
	constructor(p1, p2) {
		this.x = p2['x']-p1['x'];
		this.y = p2['y']-p1['y'];
	}
	translatePt(startCoords) {
		return {'x': startCoords.x+this.x, 'y': startCoords.y+this.y};
	}
	scalarProduct(v) {
		return this.x * v.x + this.y * v.y;
	}
	sqNorm() {
		return this.scalarProduct(this);
	}
	cosAngle(v) {
		return this.scalarProduct(v) / Math.sqrt( this.sqNorm() * v.sqNorm() );
	}
}

class HullRunner {
	constructor(){
		this.points = [];
		this.svg = document.getElementById("hullDrawing");
		
		this.readSize();
		
		this.runPauseButton = document.getElementById("runPauseButton");
		this.statusMessage = document.getElementById("stepText");
		this.algorithmPick = document.getElementById("algorithmPick");
		
		this.lastSetup = this.randomPoints;
		this.lastSetup();
		this.modified = false;
		this.restart();
	}
	
	readSize(){
		var wrapper = document.getElementById("hullDrawingContainer");
		this.width = wrapper.clientWidth;
		this.height = wrapper.clientHeight;
		this.size = Math.min(this.width, this.height);
		this.offsetLeft = wrapper.offsetLeft;
		this.offsetTop = wrapper.offsetTop;
	}
	
	clear(){
		this.pause();
		this.modified = true;
		while(this.points.length > 0)
		{
			this.svg.removeChild(this.points.shift());
		}
	}
	
	restart(){
		this.pause();
		if(this.solver){
			this.solver.erase();
		}
		for(var ii = 0 ; ii < this.points.length ; ii++){
			this.points[ii].setAttribute("class", "normal");
		}
		this.modified = false;
		this.curAlgorithmName = this.algorithmPick.options[this.algorithmPick.selectedIndex].value;
		this.solver = new solversDict[this.curAlgorithmName](this);
		if(this.points.length > 2) {
			this.run();
		}
		else {
			this.statusMessage.textContent = "Add more points to compute the hull.";
		}
	}
	
	run(){
		this.runPauseButton.textContent = "Pause";
		this.runPauseButton.setAttribute("onclick", "hullMaker.pause(); return false;");
		if(this.modified) {
			this.restart();
		}
		else {
			this.runInterval = setInterval(function(){
				// ugly global; fix if want multiple solvers
				hullMaker.solver.step();
				}, tickTime);
		}
	}
	
	pause(){
		this.runPauseButton.textContent = "Run";
		this.runPauseButton.setAttribute("onclick", "hullMaker.run(); return false;");
		clearInterval(this.runInterval);
	}
	
	// Points setup
	createPoint(x, y){
		this.pause();
		
		var newPoint = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		
		newPoint.setAttribute("cx", x);
		newPoint.setAttribute("cy", y);
		newPoint.setAttribute("r", this.size * pointRadius);
		newPoint.setAttribute("class", "normal");
		newPoint.setAttribute("stroke-width", this.size * strokeWidth);
		
		this.svg.appendChild(newPoint);
		this.points.push(newPoint);
		this.modified = true;
	}
	
	togglePoint(mousePos){
		var x = mousePos.pageX - this.offsetLeft;
		var y = mousePos.pageY - this.offsetTop;
		
		var absRadius = this.size * pointRadius;
		for(var pt_i = 0 ; pt_i < this.points.length ; pt_i++){
			var curPt = this.points[pt_i];
			var curCoords = pointToCoords(curPt);
			var distance = Math.pow(curCoords['x']-x, 2) + Math.pow(curCoords['y']-y, 2);
			if( distance <= Math.pow(absRadius, 2) ){
				this.svg.removeChild(curPt);
				this.points.splice(pt_i, 1);
				return;
			}
		}
		this.createPoint(x, y);
	}
	
	randomPoints(){
		this.clear();
		var nbPoints = Math.floor( 20 + 80*Math.random() );
		for(var pt_i = 0 ; pt_i < nbPoints ; pt_i++){
			this.createPoint(
				this.width * Math.random(),
				this.height * Math.random()
			);
		}
		this.lastSetup = this.randomPoints;
	}
	
	randomGrid(){
		this.clear();
		
		var pxGridSize = 40;
		var xSteps = Math.floor(this.width / pxGridSize);
		var ySteps = Math.floor(this.height / pxGridSize);
		var totalSteps = (xSteps-1)*(ySteps-1);
		var occupyProbability = 60/totalSteps;
		
		for(var x_i = 1 ; x_i < xSteps ; x_i++){
			for(var y_i = 1 ; y_i < ySteps ; y_i++){
				if( Math.random() < occupyProbability ){
					this.createPoint( pxGridSize*x_i, pxGridSize*y_i );
				}
			}
		}
		this.lastSetup = this.randomGrid;
	}
	
	// Display
	setStatusMessageFromStep(stepName) {
		console.log(this.curAlgorithmName + stepName);
		var statusText = document.getElementById(this.curAlgorithmName + stepName).textContent;
		if(statusText) {
			this.statusMessage.textContent = statusText;
		}
		else {
			console.log("No status message for " + this.curAlgorithmName + stepName);
		}
	}
}

class HullSolver {
	constructor(hullRunner){
		this.hullRunner = hullRunner; // Circular reference, remember to clear
		this.drawnGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
		this.hullRunner.svg.appendChild(this.drawnGroup);
		this.currentStep = null;
	}
	erase(){
		this.hullRunner.svg.removeChild(this.drawnGroup);
		this.hullRunner = undefined; // Clear reference to allow garbage collection
	}
	step(){
		this.hullRunner.setStatusMessageFromStep(this.currentStep.name);
		this.currentStep = this.currentStep();
	}
	drawLine(startCoords, endCoords){
		var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
		line.setAttribute("x1", startCoords.x);
		line.setAttribute("y1", startCoords.y);
		line.setAttribute("x2", endCoords.x);
		line.setAttribute("y2", endCoords.y);
		line.setAttribute("stroke-width", this.hullRunner.size * strokeWidth);
		line.setAttribute("stroke", "black");
		line.setAttribute("class", "normal");
		this.drawnGroup.appendChild(line);
		return line;
	}
}

class Giftwrap extends HullSolver {
	constructor(hullRunner){
		super(hullRunner);
		this.currentStep = this.Setup;
	}
	
	drawDirectionArrow(){
		var currentCoords = pointToCoords(this.currentPt);
		var directionMarker = this.currentDir.translatePt(currentCoords);
		this.directionLine = this.drawLine(currentCoords, directionMarker);
		this.directionLine.setAttribute("marker-end", "url(#arrow)");
	}
	
	Setup(){
		// Start from the leftmost point and a downwards direction.
		this.points = this.hullRunner.points.slice();
		
		var minX = Number.MAX_VALUE;
		var maxY = -Number.MAX_VALUE;
		this.startPt = null;
		
		for(var ii = 0 ; ii < this.points.length ; ii++){
			var pt = this.points[ii];
			var coords = pointToCoords(pt);
			if((coords['x'] < minX) || ((coords['x'] == minX) && (coords['y'] > maxY))) {
				minX = coords['x'];
				maxY = coords['y'];
				this.startPt = pt;
			}
		}
		this.startPt.setAttribute("class", "inHull");
		this.currentPt = this.startPt;
		this.currentDir = new Vector({"x": 0, "y": 0}, {"x": 0, "y": this.hullRunner.size/10});
		
		this.drawDirectionArrow();
		
		return this.TurnAngles;
	}
	
	TurnAngles(){
		// Look at how far left you have to turn to reach each point...
		var currentCoords = pointToCoords(this.currentPt);
		
		this.turnLines = [];
		this.turnCosAngles = [];
		this.candidates = [];
		for(var ii = 0 ; ii < this.points.length ; ii++) {
			var pt = this.points[ii];
			if(pt != this.currentPt) {
				var coords = pointToCoords(pt);
				var line = this.drawLine(currentCoords, coords);
				line.setAttribute("class", "inactive");
				this.turnLines.push(line);
				this.candidates.push(pt);
				var newDir = new Vector(currentCoords, coords);
				this.turnCosAngles.push(this.currentDir.cosAngle(newDir));
			}
		}
		return this.Select;
	}
	
	Select(){
		// ...and pick the smallest turn.
		var i_nextPt = this.turnCosAngles.indexOf(Math.max(...this.turnCosAngles));
		for(var ii = 0 ; ii < this.turnLines.length ; ii++) {
			if(ii != i_nextPt) {
				this.drawnGroup.removeChild(this.turnLines[ii]);
			}
		}
		this.turnLines[i_nextPt].setAttribute("class", "inHull");
		var nextPt = this.candidates[i_nextPt];
		this.points.splice(this.points.indexOf(nextPt), 1);
		nextPt.setAttribute("class", "inHull");
		
		this.currentDir = new Vector(pointToCoords(this.currentPt), pointToCoords(nextPt));
		this.currentPt = nextPt;
		
		this.drawnGroup.removeChild(this.directionLine);
		
		return this.FindNext;
	}
	
	FindNext(){
		// Continue from the new point and the current direction.
		this.drawDirectionArrow();
		if(this.currentPt == this.startPt){
			return this.Finish;
		}
		else {
			return this.TurnAngles;
		}
	}
	
	Finish(){
		// Once you're back at the start, you're done.
		this.hullRunner.pause();
		this.drawnGroup.removeChild(this.directionLine);
	}
}

class Graham extends HullSolver {
	constructor(hullRunner){
		super(hullRunner);
		this.currentStep = this.Setup;
	}
	
	Setup(){
		// Start from the leftmost point.
		this.points = this.hullRunner.points.slice();
		
		var minX = Number.MAX_VALUE;
		var maxY = -Number.MAX_VALUE;
		this.startPt = null;
		
		for(var ii = 0 ; ii < this.points.length ; ii++){
			var pt = this.points[ii];
			var coords = pointToCoords(pt);
			if((coords['x'] < minX) || ((coords['x'] == minX) && (coords['y'] > maxY))) {
				minX = coords['x'];
				maxY = coords['y'];
				this.startPt = pt;
			}
		}
		this.startPt.setAttribute("class", "inHull");
		this.hull = [ this.startPt ];
		this.points.splice(this.points.indexOf(this.startPt), 1);
		return this.Presort;
	}
	Presort(){
		// Sort all points by angle from the starting point.
		var downwards = new Vector({"x": 0, "y": 0}, {"x": 0, "y": 1});
		var startCoords = pointToCoords(this.startPt);
		this.points.sort(function(p1, p2){
			var cosAngle = function(pt) {return downwards.cosAngle(new Vector(startCoords, pointToCoords(pt)));};
			return cosAngle(p2) - cosAngle(p1);
		});
		
		this.sortingLines = [];
		for(var ii = 0 ; ii < this.points.length ; ii++){
			var line = this.drawLine(startCoords, pointToCoords(this.points[ii]));
			var r = Math.round(255*(1 - ii/this.points.length));
			var g = Math.round(255*ii/this.points.length);
			var b = r;
			line.setAttribute("class", "");
			line.setAttribute("stroke", "rgb("+r+","+g+","+b+")");
			this.sortingLines.push(line);
		}
		
		this.hullLines = [];
		this.points.push(this.startPt);
		
		return this.TryNext;
	}
	
	isLeftTurn(p1, p2, p3){
		var c1 = pointToCoords(p1);
		var c2 = pointToCoords(p2);
		var c3 = pointToCoords(p3);
		return (c2.x - c1.x)*(c3.y - c1.y) < (c2.y - c1.y)*(c3.x - c1.x);
	}
	
	TryNext(){
		// Try adding a point in the hull, and consider the turn between that point and the next.
		var prevPt = this.hull[this.hull.length-1];
		var candidatePt = this.points.shift();
		this.hull.push(candidatePt);
		var nextPt = this.points[0];
		
		while(this.sortingLines.length > 0)
		{
			this.drawnGroup.removeChild(this.sortingLines.shift());
		}
		
		for(var ii = 0 ; ii < this.hull.length - 1 ; ii++)
		{
			var line = this.drawLine( pointToCoords(this.hull[ii]), pointToCoords(this.hull[ii+1]) );
			line.setAttribute("class", "inHull");
			this.hullLines.push(line);
		}
		
		candidatePt.setAttribute("class", "candidate");
		nextPt.setAttribute("class", "compared");
		this.turnLine = this.drawLine(pointToCoords(candidatePt), pointToCoords(nextPt));
		this.turnLine.setAttribute("class", "compared");
		
		if(this.isLeftTurn(prevPt, candidatePt, nextPt)){
			return this.TurnLeft;
		}
		else{
			return this.TurnRight;
		}
	}
	TurnLeft(){
		// If it's a left turn, keep it in the hull and try the next point.
		this.drawnGroup.removeChild(this.turnLine);
		this.hull[this.hull.length-1].setAttribute("class", "inHull");
		if(this.points.length > 1){
			return this.TryNext;
		}
		else{
			return this.Finish;
		}
	}
	TurnRight(){
		// If it's a right turn, remove it from the list of points.
		this.hull.pop().setAttribute("class", "inactive");
		this.points.unshift(this.hull.pop());
		
		this.drawnGroup.removeChild(this.turnLine);
		while(this.hullLines.length > 0)
		{
			this.drawnGroup.removeChild(this.hullLines.pop());
		}
		
		if(this.points.length > 1){
			return this.TryNext;
		}
		else{
			return this.Finish;
		}
	}
	Finish(){
		// Once you're out of points, you're done.
		this.startPt.setAttribute("class", "inHull");
		this.hullRunner.pause();
	}
}

solversDict = {"giftwrap": Giftwrap, "graham": Graham};

function populateAlgorithmPicker() {
	algorithmPicker = document.getElementById("algorithmPick");
	
	while(algorithmPicker.children.length > 0) {
		algorithmPicker.removeChild(algorithmPicker.firstElementChild);
	}
	
	algorithms = document.getElementById("algorithms").getElementsByTagName("dt");
	for(var alg_i = 0 ; alg_i < algorithms.length ; alg_i += 1) {
		var algDefn = algorithms[alg_i];
		var algId = algDefn.id;
		var algName = algDefn.textContent;
		
		var option = document.createElement("option");
		option.setAttribute("value", algId);
		option.textContent = algName;
		algorithmPicker.appendChild(option);
	}
}

populateAlgorithmPicker();
hullMaker = new HullRunner();

hullMaker.svg.addEventListener("click", function(mousePos){hullMaker.togglePoint(mousePos);}, false);

window.addEventListener("resize", function() {
	hullMaker.pause();
	hullMaker.readSize();
	hullMaker.lastSetup();
	hullMaker.restart();
}, false);
