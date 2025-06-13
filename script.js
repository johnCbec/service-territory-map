// Add this variable at the top of your script.js, outside any function,
// so it can be accessed and cleared globally
let currentMarker = null;

document.addEventListener('DOMContentLoaded', function() {
    // --- 1. Initialize the Leaflet Map ---
    const map = L.map('map').setView([38.0, -80.0], 9); // Initial view: roughly Alleghany, WV, zoom level 9

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // --- 2. Load and Display Your Service Territory GeoJSON ---
    fetch('service-territory.geojson') // Make sure this path is correct
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(geojson => {
            const serviceLayer = L.geoJson(geojson, {
                style: function(feature) {
                    return {
                        fillColor: '#FFD700', // Gold-ish yellow
                        weight: 2,
                        opacity: 0.8,
                        color: 'white',
                        dashArray: '3',
                        fillOpacity: 0.5
                    };
                },
                onEachFeature: function (feature, layer) {
                    // Optional: Add a popup with feature properties if your GeoJSON has any
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup(feature.properties.name);
                    }
                }
            }).addTo(map);

            // Optional: Fit the map bounds to your GeoJSON layer
            map.fitBounds(serviceLayer.getBounds());

            // --- ADDED THIS LINE TO FORCE MAP REDRAW ---
            map.invalidateSize(); // Force Leaflet to re-check its container size and redraw
            // ------------------------------------------

        })
        .catch(error => {
            console.error('Error loading or parsing GeoJSON:', error);
            document.getElementById('result').textContent = 'Error loading map data.';
        });

    // --- 3. Address Checker Logic ---
    const checkAddressForm = document.getElementById('checkAddressForm');
    const addressInput = document.getElementById('addressInput');
    const resultDiv = document.getElementById('result');

    // --- IMPORTANT: This is YOUR deployed Cloud Run Service URL ---
    const CLOUD_RUN_BASE_URL = 'https://check-service-area-api-251932089220.us-east4.run.app';

    checkAddressForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        resultDiv.textContent = 'Checking address...';
        resultDiv.style.color = 'black'; // Reset color

        const address = addressInput.value;

        try {
            // Construct the full URL to your Cloud Run endpoint
            const response = await fetch(CLOUD_RUN_BASE_URL + '/check-service-area', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: address }),
            });

            const data = await response.json(); // Parse the JSON response from your backend

            // --- NEW CODE FOR PIN & PAN ---
            // Clear existing marker if any
            if (currentMarker) {
                map.removeLayer(currentMarker);
            }

            // Check if coordinates were returned (address found)
            if (data.latitude && data.longitude) {
                const latlng = [data.latitude, data.longitude];
                currentMarker = L.marker(latlng).addTo(map)
                    .bindPopup(`<b>${address}</b><br>Service Area: ${data.isInServiceArea ? 'Yes' : 'No'}`)
                    .openPopup(); // Show popup immediately

                // Pan/zoom to the new marker. Adjust zoom level as needed (e.g., 15 for street level)
                map.setView(latlng, 15);
            }
            // --- END NEW CODE ---

            if (response.ok) {
                if (data.isInServiceArea) {
                    // --- UPDATED SUCCESS MESSAGE WITH LINK ---
                    const formPageUrl = 'https://www.beeonlineadv.com/waitlistregistration'; // REPLACE THIS WITH YOUR ACTUAL SQAURESPACE FORM PAGE URL
                    resultDiv.innerHTML = `
                        Great news! Your address is within our upcoming service area!
                        <br>Click here to sign up for our waiting list:
                        <a href="${formPageUrl}" target="_blank" rel="noopener noreferrer">Alleghany County Waitlist — Bee Online Advantage</a>
                    `;
                    resultDiv.style.color = 'green'; // Keep the green color for the whole block
                    // ------------------------------------------
                } else {
                    // This case covers addresses found but outside territory
                    resultDiv.textContent = 'Unfortunately, your address is not currently within our upcoming service area.';
                    resultDiv.style.color = 'red';
                }
            } else {
                // This handles cases where Geocoding API couldn't find the address (e.g., 404 status)
                resultDiv.textContent = data.message || 'An error occurred. Please try again.';
                resultDiv.style.color = 'orange';
                console.error('Backend API Error:', data.message);
            }

        } catch (error) {
            console.error('Frontend Fetch Error:', error);
            resultDiv.textContent = 'An error occurred. Please try again later.';
            resultDiv.style.color = 'orange';
        }
    });
});