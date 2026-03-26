let pieChart;
let barChart;

// ✅ 1. Create map
const map = L.map('map').setView([-1.286389, 36.817223], 13);

// ✅ 2. Basemap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ✅ Globals
let geojsonLayer;
let searchIndex = [];

// 💰 Format money (KES)
function formatMoney(value) {
    return value.toLocaleString('en-KE', {
        style: 'currency',
        currency: 'KES'
    });
}

// 🎨 Color logic
function getColor(status) {
    if (!status) return "gray";

    status = status.toLowerCase();

    if (status.includes("not")) return "red";
    if (status.includes("partial")) return "orange";
    if (status.includes("paid")) return "green";

    return "gray";
}

// 🗺️ Style
function style(feature) {
    return {
        color: getColor(feature.properties["Payment Status"]),
        weight: 1,
        fillOpacity: 0.6
    };
}

// 📍 Popup
function onEachFeature(feature, layer) {
    let content = "<b>Parcel Info</b><br>";

    for (let key in feature.properties) {
        content += `<b>${key}:</b> ${feature.properties[key]}<br>`;
    }

    content += `<br><button onclick="payParcel('${feature.properties.PLOTNO}')">Pay Now</button>`;

    layer.bindPopup(content);
}

// 📥 Load GeoJSON
fetch('pacess.geojson')
.then(res => res.json())
.then(data => {

    geojsonLayer = L.geoJSON(data, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds());

    geojsonLayer.eachLayer(layer => {
        const props = layer.feature.properties;

        searchIndex.push({
            plot: props.PLOTNO,
            owner: props["Owner Name"] || props.HSE_NAME,
            layer: layer
        });
    });

    calculateStats();
});


// 🔍 SMART SEARCH
function smartSearch() {

    const input = document.getElementById("searchBox").value.trim().toLowerCase();

    geojsonLayer.resetStyle();

    let matched = [];

    geojsonLayer.eachLayer(layer => {

        const props = layer.feature.properties;
        const plot = props.PLOTNO;
        const owner = props["Owner Name"] || props.HSE_NAME;

        let isMatch = false;

        if (!isNaN(input) && plot && plot.toString() === input) {
            isMatch = true;
        }

        if (!isMatch && owner && owner.toLowerCase().includes(input)) {
            isMatch = true;
        }

        if (isMatch) {
            layer.setStyle({
                color: "yellow",
                weight: 3
            });

            matched.push(layer);
        }
    });

    if (matched.length === 0) {
        alert("No match found");
        return;
    }

    const group = L.featureGroup(matched);
    map.fitBounds(group.getBounds());
}


// 🔽 AUTOCOMPLETE
function showSuggestions() {

    const input = document.getElementById("searchBox").value.toLowerCase();
    const box = document.getElementById("suggestions");

    box.innerHTML = "";

    if (!input) {
        box.style.display = "none";
        return;
    }

    const matches = searchIndex.filter(item => 
        (item.plot && item.plot.toString().includes(input)) ||
        (item.owner && item.owner.toLowerCase().includes(input))
    ).slice(0, 5);

    matches.forEach(item => {
        const div = document.createElement("div");

        div.innerHTML = `<b>${item.plot || ""}</b> - ${item.owner || ""}`;

        div.onclick = () => {
            document.getElementById("searchBox").value = item.plot || item.owner;
            box.style.display = "none";
            zoomToLayer(item.layer);
        };

        box.appendChild(div);
    });

    box.style.display = "block";
}


// 📍 Zoom helper
function zoomToLayer(layer) {
    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    layer.openPopup();
}


// 🎛️ FILTER
function applyFilter() {

    const selected = document.getElementById("statusFilter").value.toLowerCase();

    geojsonLayer.eachLayer(layer => {

        const status = layer.feature.properties["Payment Status"];

        if (selected === "all") {
            layer.addTo(map);
        } 
        else if (status && status.toLowerCase().includes(selected)) {
            layer.addTo(map);
        } 
        else {
            map.removeLayer(layer);
        }
    });

    calculateStats();
}


// 📊 COUNTY DASHBOARD STATS
function calculateStats() {

    let paid = 0, notPaid = 0, partial = 0, unknown = 0;

    let totalLandRent = 0;
    let totalAmountDue = 0;

    geojsonLayer.eachLayer(layer => {

        if (!map.hasLayer(layer)) return;

        const props = layer.feature.properties;
        const status = (props["Payment Status"] || "").toLowerCase();

        // ✅ Clean classification
        if (status.includes("not")) {
        notPaid++;
        } 
        else if (status.includes("partial")) {
        partial++;
        } 
        else if (status.includes("paid")) {
        paid++;
        } 
        else {
        unknown++;
        }

        const landRent = parseFloat(props["Land Rent Amount (KSH)"]) || 0;
        const amountDue = parseFloat(props["Amount Due"]) || 0;

        totalLandRent += landRent;
        totalAmountDue += amountDue;
    });

    const collected = totalLandRent - totalAmountDue;
    const outstanding = totalAmountDue;
    const efficiency = totalLandRent ? (collected / totalLandRent) * 100 : 0;

    // 📊 Update UI
    document.getElementById("stats").innerHTML = `
        <b>Revenue Summary</b><br>
        💰 Collected: ${formatMoney(collected)}<br>
        💸 Outstanding: ${formatMoney(outstanding)}<br>
        📈 Efficiency: ${efficiency.toFixed(1)}%<br><br>

        <b>Parcel Stats</b><br>
        🟢 Paid: ${paid}<br>
        🔴 Not Paid: ${notPaid}<br>
        🟠 Partial: ${partial}<br>
        ⚪ Unknown: ${unknown}
    `;

    // 📈 PIE CHART
    if (pieChart) pieChart.destroy();

    pieChart = new Chart(document.getElementById("chart"), {
        type: 'pie',
        data: {
            labels: ['Paid', 'Not Paid', 'Partial', 'Unknown'],
            datasets: [{
                data: [paid, notPaid, partial, unknown]
            }]
        }
    });

    // 📊 BAR CHART (Revenue)
    if (barChart) barChart.destroy();

    barChart = new Chart(document.getElementById("barChart"), {
        type: 'bar',
        data: {
            labels: ['Collected', 'Outstanding'],
            datasets: [{
                data: [collected, outstanding]
            }]
        }
    });
}


// 💳 MOCK PAYMENT
function payParcel(plot) {
    alert("M-Pesa payment initiated for plot " + plot);
}


// 📤 EXPORT CSV
function exportCSV() {

    let csv = "Plot,Owner,Status\n";

    geojsonLayer.eachLayer(layer => {

        if (!map.hasLayer(layer)) return;

        const props = layer.feature.properties;

        csv += `${props.PLOTNO},${props["Owner Name"]},${props["Payment Status"]}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "parcels.csv";
    a.click();
}