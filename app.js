let pieChart;
let barChart;

const map = L.map('map').setView([-1.286389, 36.817223], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let geojsonLayer;
let searchIndex = [];
let currentMaxAmount = 100000; // ✅ slider state

function formatMoney(value) {
    return value.toLocaleString('en-KE', {
        style: 'currency',
        currency: 'KES'
    });
}

function getColor(status) {
    if (!status) return "gray";
    status = status.toLowerCase();
    if (status.includes("not")) return "red";
    if (status.includes("partial")) return "orange";
    if (status.includes("paid")) return "green";
    return "gray";
}

function style(feature) {
    return {
        color: getColor(feature.properties["Payment Status"]),
        weight: 1,
        fillOpacity: 0.6
    };
}

function onEachFeature(feature, layer) {
    let content = "<b>Parcel Info</b><br>";
    for (let key in feature.properties) {
        content += `<b>${key}:</b> ${feature.properties[key]}<br>`;
    }
    content += `<br><button onclick="payParcel('${feature.properties.PLOTNO}')">Pay Now</button>`;
    layer.bindPopup(content);
}

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

// ✅ NEW FILTER FUNCTION (slider)
function filterByAmount(value) {

    currentMaxAmount = parseFloat(value);
    document.getElementById("sliderValue").innerText = value;

    applyAllFilters();
}

// ✅ COMBINED FILTER LOGIC
function applyAllFilters() {

    const selected = document.getElementById("statusFilter").value.toLowerCase();

    geojsonLayer.eachLayer(layer => {

        const props = layer.feature.properties;
        const status = (props["Payment Status"] || "").toLowerCase();
        const amountDue = parseFloat(props["Amount Due"]) || 0;

        let statusMatch =
            selected === "all" ||
            (status && status.includes(selected));

        let amountMatch = amountDue <= currentMaxAmount;

        if (statusMatch && amountMatch) {
            layer.addTo(map);
        } else {
            map.removeLayer(layer);
        }
    });

    calculateStats();
}

// 🔁 UPDATED to use combined filters
function applyFilter() {
    applyAllFilters();
}

// (rest of your code stays EXACTLY the same below 👇)

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
            layer.setStyle({ color: "yellow", weight: 3 });
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

// (keep everything else unchanged…)

function calculateStats() {
    let paid = 0, notPaid = 0, partial = 0, unknown = 0;
    let totalLandRent = 0;
    let totalAmountDue = 0;

    geojsonLayer.eachLayer(layer => {
        if (!map.hasLayer(layer)) return;

        const props = layer.feature.properties;
        const status = (props["Payment Status"] || "").toLowerCase();

        if (status.includes("not")) notPaid++;
        else if (status.includes("partial")) partial++;
        else if (status.includes("paid")) paid++;
        else unknown++;

        totalLandRent += parseFloat(props["Land Rent Amount (KSH)"]) || 0;
        totalAmountDue += parseFloat(props["Amount Due"]) || 0;
    });

    const collected = totalLandRent - totalAmountDue;
    const outstanding = totalAmountDue;
    const efficiency = totalLandRent ? (collected / totalLandRent) * 100 : 0;

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

    if (pieChart) pieChart.destroy();
    pieChart = new Chart(document.getElementById("chart"), {
        type: 'pie',
        data: {
            labels: ['Paid', 'Not Paid', 'Partial', 'Unknown'],
            datasets: [{ data: [paid, notPaid, partial, unknown] }]
        }
    });

    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById("barChart"), {
        type: 'bar',
        data: {
            labels: ['Collected', 'Outstanding'],
            datasets: [{ data: [collected, outstanding] }]
        }
    });
}

function payParcel(plot) {
    alert("M-Pesa payment initiated for plot " + plot);
}

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

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("toggleSidebar");

    sidebar.classList.toggle("collapsed");

    btn.innerHTML = sidebar.classList.contains("collapsed") ? "➡" : "☰";

    setTimeout(() => map.invalidateSize(), 300);
}
