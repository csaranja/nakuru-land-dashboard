let pieChart;
let barChart;
let geojsonLayer;
let currentMaxAmount = 100000;

/* ===== MAP ===== */
const map = L.map('map').setView([-1.286389,36.817223],13);

/* BASEMAPS */
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
const satellite = L.tileLayer(
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
);

osm.addTo(map);

L.control.layers({
"Street Map":osm,
"Satellite":satellite
}).addTo(map);


/* ===== WELCOME MESSAGE ===== */
function setWelcomeMessage(){

const hour = new Date().getHours();
let message;

if(hour < 12) message = "Good Morning ☀️ — Welcome to the Land Rates Monitoring System.";
else if(hour < 18) message = "Good Afternoon 🌤️ — Welcome to the Land Rates Monitoring System.";
else message = "Good Evening 🌙 — Welcome to the Land Rates Monitoring System.";

document.getElementById("welcomeMessage").innerText = message;

}

setWelcomeMessage();


/* ===== SIDEBAR TOGGLE ===== */
function toggleSidebar(){
document.getElementById("sidebar").classList.toggle("collapsed");
}


/* ===== LEGEND ===== */
const legend = L.control({position:"bottomright"});

legend.onAdd = function(){

const div = L.DomUtil.create("div","legend");

div.innerHTML += "<b>Payment Status</b><br>";
div.innerHTML += "<i style='background:green'></i> Paid<br>";
div.innerHTML += "<i style='background:orange'></i> Partial<br>";
div.innerHTML += "<i style='background:red'></i> Not Paid";

return div;

};

legend.addTo(map);


/* ===== COLOR FUNCTION ===== */
function getColor(status){

if(!status) return "gray";

status = status.toLowerCase();

if(status.includes("not")) return "red";
if(status.includes("partial")) return "orange";
if(status.includes("paid")) return "green";

return "gray";

}


/* ===== STYLE ===== */
function style(feature){
return {
color:getColor(feature.properties["Payment Status"]),
weight:1,
fillOpacity:0.6
};
}


/* ===== POPUP ===== */
function onEachFeature(feature,layer){

const p = feature.properties;

const popup = `
<b>Parcel Details</b><br>
Plot: ${p.PLOTNO}<br>
Owner: ${p["Owner Name"] || "Unknown"}<br>
Status: ${p["Payment Status"]}<br>
Amount Due: KES ${p["Amount Due"]}
`;

layer.bindPopup(popup);

layer.on({
mouseover:function(e){
e.target.setStyle({weight:3,color:"#000"});
},
mouseout:function(e){
geojsonLayer.resetStyle(e.target);
}
});

}


/* ===== LOAD DATA ===== */
fetch('pacess.geojson')
.then(res=>res.json())
.then(data=>{

geojsonLayer = L.geoJSON(data,{
style:style,
onEachFeature:onEachFeature
}).addTo(map);

map.fitBounds(geojsonLayer.getBounds());
calculateStats();

});


/* ===== FILTERS ===== */
function filterByAmount(value){
currentMaxAmount = parseFloat(value);
document.getElementById("sliderValue").innerText = value;
applyFilter();
}

function applyFilter(){

const selected = document.getElementById("statusFilter").value.toLowerCase();

geojsonLayer.eachLayer(layer=>{

const props = layer.feature.properties;

const status = (props["Payment Status"] || "").toLowerCase();
const amount = parseFloat(props["Amount Due"]) || 0;

let statusMatch = selected==="all" || status.includes(selected);
let amountMatch = amount <= currentMaxAmount;

if(statusMatch && amountMatch){
layer.setStyle({fillOpacity:0.6,opacity:1});
}else{
layer.setStyle({fillOpacity:0,opacity:0});
}

});

calculateStats();

}


/* ===== STATS ===== */
function calculateStats(){

let paid=0,notPaid=0,partial=0;
let totalRent=0;
let totalDue=0;

geojsonLayer.eachLayer(layer=>{

if(layer.options.fillOpacity===0) return;

const props=layer.feature.properties;
const status=(props["Payment Status"] || "").toLowerCase();

if(status.includes("not")) notPaid++;
else if(status.includes("partial")) partial++;
else if(status.includes("paid")) paid++;

totalRent+=parseFloat(props["Land Rent Amount (KSH)"]) || 0;
totalDue+=parseFloat(props["Amount Due"]) || 0;

});

const collected = totalRent - totalDue;

/* PIE CHART */
if(pieChart) pieChart.destroy();

pieChart = new Chart(document.getElementById("chart"),{
type:"pie",
data:{
labels:["Paid","Not Paid","Partial"],
datasets:[{
data:[paid,notPaid,partial]
}]
}
});

/* BAR CHART */
if(barChart) barChart.destroy();

barChart = new Chart(document.getElementById("barChart"),{
type:"bar",
data:{
labels:["Collected","Outstanding"],
datasets:[{
data:[collected,totalDue]
}]
}
});

}


/* ===== EXPORT CSV ===== */
function exportCSV(){

let csv="Plot,Owner,Status,Amount Due\n";

geojsonLayer.eachLayer(layer=>{

const props=layer.feature.properties;

csv+=`${props.PLOTNO},${props["Owner Name"]},${props["Payment Status"]},${props["Amount Due"]}\n`;

});

const blob=new Blob([csv],{type:'text/csv'});
const url=URL.createObjectURL(blob);

const a=document.createElement("a");
a.href=url;
a.download="parcels.csv";
a.click();

}
