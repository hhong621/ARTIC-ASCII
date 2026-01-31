// --- Configuration ---
const ARTWORKS_URL = "https://api.artic.edu/api/v1/artworks";
const CACHE_KEY = 'aicArtworksCache';
const CACHE_DURATION = 60 * 60 * 1000; // Cache expiration time in milliseconds (1 hour = 60 * 60 * 1000)
let currentIndex = 0;
let isRevealed = false;
const artworkText = document.getElementById('artwork-text');
const artworkImage = document.getElementById('image');
const canvas = document.getElementById('textmode-canvas');
const overlay = document.getElementById('overlay');
const imageContainer = document.getElementById('image-container');
const artworkContainer = document.getElementById('artwork-container');
const controls = document.getElementById('controls');

/**
 * Use limit = 0 to get the total number of artworks from the API
 * @returns number of total pages
 */
async function getPageTotal() {
    // Get the total number of artworks (using limit=0)
    try {
        const countResponse = await fetch(`${ARTWORKS_URL}?limit=0`);
        if (!countResponse.ok) {
            throw new Error(`HTTP error! status: ${countResponse.status}`);
        }
        const countData = await countResponse.json();

        const totalArtworks = countData.pagination.total;
        if (totalArtworks === 0) {
            console.error("Error: Total artwork count is zero.");
            return null;
        } else {
            return totalArtworks;
        }
    } catch (error) {
        console.error('An error occurred while fetching total artwork count:', error);
        return null;
    }
}

/**
 * Use the getPageTotal() function to generate random IDs
 * @returns array of random artwork IDs
 */
async function getRandomIDs() {
    let idArr = [];
    const response = await getPageTotal();
    for (let i = 0; i < 10; i++) {
        const randomID = Math.floor(Math.random() * response) + 1;
        idArr.push(randomID);
    }
    return idArr;
}

/**
 * Fetches artwork data, checking the cache first.
 * @returns {Promise<Array<Object> | null>} The array of artworks or null on error.
 */
async function fetchArtworksAndCache() {
    const cachedData = localStorage.getItem(CACHE_KEY);

    if (cachedData) {
        try {
            const cache = JSON.parse(cachedData);
            const now = new Date().getTime();

            // Check for cache hit and freshness
            if (now - cache.timestamp < CACHE_DURATION) {
                console.log('Data retrieved from CACHE. (Timestamp: ' + new Date(cache.timestamp).toLocaleTimeString() + ')');
                // Return the data array directly
                return cache.data;
            } else {
                console.log('Cached data found but has EXPIRED. Fetching new data...');
                // Proceed to fetch new data
            }
        } catch (e) {
            console.error('Error parsing cached data. Fetching new data.', e);
            // If parsing fails, proceed to fetch new data
        }
    } else {
        console.log('No cached data found. Fetching from API...');
        // Proceed to fetch new data
    }

    // Fetch data from the AIC API (Network call)
    try {
        const idString = (await getRandomIDs()).join(',');
        console.log(idString);
        const response = await fetch(`${ARTWORKS_URL}?ids=${idString}&fields=id,title,image_id,artist_display,date_display`);

        // Throw an error if the HTTP response status is not successful
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const apiResponse = await response.json();

        // Ensure we extract only the necessary 'data' array
        const artworks = apiResponse.data;

        // Update the cache with the new data and a fresh timestamp
        const cachePayload = {
            timestamp: new Date().getTime(),
            data: artworks
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));

        console.log('Successfully fetched data from API and updated the CACHE. (Timestamp: ' + new Date(cachePayload.timestamp).toLocaleTimeString() + ')');
        return artworks;

    } catch (error) {
        console.error('An error occurred during API fetch:', error);
        document.getElementById('artworks-list').innerHTML = `<li class="text-red-600">Failed to load data: ${error.message}</li>`;
        return null;
    }
}

// --- Implementation and Rendering ---
const t = textmode.create({canvas, width: 600, height: 600});

let myImage;
let characters = " .:-=+*#%@";
let imageUrl;

/**
 * Construct imageUrl using artwork image ID
 * @returns imageUrl string
 */
async function getImageUrl() {
    const artworkData = await fetchArtworksAndCache();
    if (artworkData && artworkData.length > 0) {
        const artwork = artworkData[currentIndex];
        const imageUrl = `https://www.artic.edu/iiif/2/${artwork.image_id}/full/843,/0/default.jpg`;
        return imageUrl;
    }
}

/**
 * Display the data and image of the current artwork
 */
async function renderArtworkData() {

    const artworkData = await fetchArtworksAndCache();

    if (artworkData && artworkData.length > 0) {
        const artwork = artworkData[currentIndex];
        const title = document.getElementById("artwork-title");
        const artist = document.getElementById("artwork-artist");
        const date = document.getElementById("artwork-date");
        title.innerHTML = artwork.title;
        artist.innerHTML = artwork.artist_display || 'N/A';
        date.innerHTML = artwork.date_display || 'N/A';

        let tempImageUrl = await getImageUrl();
    
        // Fetch image using url
        fetch(tempImageUrl)
            .then(response => {
                if (!response.ok) {
                    // Handle image errors
                    if (currentIndex < (artworkData.length - 1)) {
                        currentIndex++;
                    } else {
                        currentIndex = 0;
                    }
                    renderArtworkData();
                    throw new Error(`Error fetching image: ${response.statusText}`);
                } else {
                    imageUrl = tempImageUrl;
                    artworkImage.src = tempImageUrl;
                    renderImage(imageUrl, characters, PARAMS.charColorMode, PARAMS.cellColorMode, PARAMS.charColor, PARAMS.cellColor);
                }
            })
            .catch(error => {
                // Handle network errors or errors thrown in the .then block
                console.error('Fetch error:', error);
            });
    } else if (!artworkData) {
        // Error case already handled in fetchArtworksAndCache, but good for cleanup
        title.innerHTML = "Could not retrieve artwork data due to an error. Check console for details.";
    } else {
        title.innerHTML = "No artworks were found with the current query.";
    }
}

t.setup(() => {
    renderArtworkData(); // initial call
});

// Handle WebGL context loss and restoration
t.canvas.addEventListener("webglcontextlost", handleContextLost, false);
t.canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

/**
 * Stop rendering if WebGL context is lost
 * @param event
 */
function handleContextLost(event) {
    // Prevent the default handling to allow context restoration
    event.preventDefault();
    console.warn("WebGL context lost - stopping render loop");
    t.noLoop();
}

/**
 * Reload window when context is restored
 */
function handleContextRestored() {
    window.location.reload();
    console.log("WebGL context restored - resuming render loop");
}

/**
 * Render the ASCII filtered image on a textmode canvas
 * @param imageUrl url string for image
 * @param characters string of characters for ascii mapping
 * @param charColorMode "fixed" for solid color | "sampled" for image colors
 * @param cellColorMode "fixed" for solid color | "sampled" for image colors
 * @param charColorVal string for char hex color value, white by default
 * @param cellColorVal string for cell hex color value, black by default
 */
async function renderImage(imageUrl, characters, charColorMode, cellColorMode, charColorVal = "ffffff", cellColorVal = "000000") {  
    myImage = await t.loadImage(imageUrl);
    // Image is now ready to use

    // Set character set for brightness mapping
    // Characters are ordered from darkest to brightest
    myImage.characters(characters);

    // Control character color mode
    myImage.charColorMode(charColorMode);

    // Control cell background color mode
    myImage.cellColorMode(cellColorMode);

     // Set fixed character color (when charColorMode is "fixed")
    myImage.charColor(charColorVal);
    
    // Set fixed cell background color (when cellColorMode is "fixed")
    myImage.cellColor(cellColorVal);

    // Draw image at full grid size
    t.resizeCanvas(600, 600);
    t.image(myImage);
}

/**
 * Tweakpane implementation
 */

import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.4/+esm';

// Setup pane and params
const pane = new Pane({
    container: controls,
});

const PARAMS = {
    charColor: '#ffffff',
    cellColor: '#000000',
    charColorMode: "sampled",
    cellColorMode: "fixed",
};

// Setup folders and bindings
const settingsFolder = pane.addFolder({
    title: 'Settings',
    expanded: true,
});

const actionsFolder = pane.addFolder({
    title: 'Actions',
    expanded: true,
});

const charColorModeBinding = settingsFolder.addBinding(PARAMS, 'charColorMode', {
    view: 'list',
    label: 'Char Color Mode',
    options: [
        {text: 'Sampled', value: 'sampled'},
        {text: 'Fixed', value: 'fixed'},
    ],
    value: 'sampled',
});

const charColorBinding = settingsFolder.addBinding(PARAMS, 'charColor', {
    label: 'Char Color',
});

const cellColorModeBinding = settingsFolder.addBinding(PARAMS, 'cellColorMode', {
    view: 'list',
    label: 'Cell Color Mode',
    options: [
        {text: 'Sampled', value: 'sampled'},
        {text: 'Fixed', value: 'fixed'},
    ],
    value: 'fixed',
});

const cellColorBinding = settingsFolder.addBinding(PARAMS, 'cellColor', {
    label: 'Cell Color',
});

// Event listener for charColorMode, charColorBinding input is hidden when set to "sampled"
charColorModeBinding.on('change', (event) => {
    const isHidden = event.value === 'sampled';
    charColorBinding.hidden = isHidden;
    PARAMS.charColorMode = event.value;
    renderImage(imageUrl, characters, PARAMS.charColorMode, PARAMS.cellColorMode, PARAMS.charColor, PARAMS.cellColor);
});

// Initial state for charColorBinding input
charColorBinding.hidden = true;

// Event listener for charColorBinding
charColorBinding.on('change', (event) => {
    renderImage(imageUrl, characters, PARAMS.charColorMode, PARAMS.cellColorMode, PARAMS.charColor, PARAMS.cellColor);
});

// Event listener for cellColorMode, cellColorBinding input is hidden when set to "sampled"
cellColorModeBinding.on('change', (event) => {
    const isHidden = event.value === 'sampled';
    cellColorBinding.hidden = isHidden;
    PARAMS.cellColorMode = event.value;
    renderImage(imageUrl, characters, PARAMS.charColorMode, PARAMS.cellColorMode, PARAMS.charColor, PARAMS.cellColor);
});

// Event listener for cellColorBinding
cellColorBinding.on('change', (event) => {
    renderImage(imageUrl, characters, PARAMS.charColorMode, PARAMS.cellColorMode, PARAMS.charColor, PARAMS.cellColor);
})

// Setup show artwork button (mobile only)
const showArtworkBtn = actionsFolder.addButton({
    title: 'View Artwork Info',
});

// Match media check
const mobileScreenMatch = window.matchMedia('(max-width: 1024px)');
 
mobileScreenMatch.addEventListener('change', screenCheck); // Onchange listener
screenCheck(); // Initial call

/**
 * Checks screen size to update show artwork button visibility
 */
function screenCheck() {
    if (mobileScreenMatch.matches) {
        showArtworkBtn.hidden = false;
    }
    else {
        showArtworkBtn.hidden = true;
    }
}

// Event listener for show artwork button click, opens sheet
showArtworkBtn.on('click', async () => {
    artworkContainer.style.display = "block";
    document.body.classList.add("modal-open");
});

// Setup next button
const nextBtn = actionsFolder.addButton({
    title: 'Next Artwork',
});

// Event listener for next button click, advance index, reset revealed state, and rerender
nextBtn.on('click', async () => {
    const artworkData = await fetchArtworksAndCache();
    if (currentIndex < (artworkData.length - 1)) {
        currentIndex++;
    } else {
        currentIndex = 0;
    }
    setIsRevealed(false);
    overlay.style.display = "flex";
    renderArtworkData();
});

// Setup reset button
const resetBtn = actionsFolder.addButton({
    title: 'Reset Colors',
});

// Event listener for reset colors button
resetBtn.on('click', async () => {
    PARAMS.charColorMode = "sampled";
    PARAMS.cellColorMode = "fixed";
    renderImage(imageUrl, characters, PARAMS.charColorMode, PARAMS.cellColorMode);
    pane.refresh();
});

/**
 * Set CSS for imageContainer and artworkText 
 * @param revealed boolean for if artwork data is revealed
 */
function setIsRevealed(revealed) {
    isRevealed = revealed;
    if (revealed) {
        imageContainer.style.top = (artworkText.offsetHeight + 32) + "px";
        artworkText.style.opacity = 1;
    } else {
        imageContainer.style.top = 0;
        artworkText.style.opacity = 0;
    }
}

// Overlay onClick listener, update revealed state to true
overlay.addEventListener('click', async () => {
    setIsRevealed(true);
    overlay.style.display = "none";
});

// Mobile event listeners

// Sheet scrim onClick listener, closes sheet
artworkContainer.addEventListener('click', async () => {
    artworkContainer.style.display = "none";
    document.body.classList.remove("modal-open");
});

// Close button onClick listener, closes sheet
document.getElementById('sheet-close').addEventListener('click', async () => {
    artworkContainer.style.display = "none";
    document.body.classList.remove("modal-open");
});

// Sheet surface onClick listener, prevents surface clicks from closing sheet
document.getElementById('artwork-wrapper').addEventListener('click', async (event) => {
    event.stopPropagation();
});

setTimeout(function(){renderImage(imageUrl, characters, PARAMS.charColorMode, PARAMS.cellColorMode)}, 1500);