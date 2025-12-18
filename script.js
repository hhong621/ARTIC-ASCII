// --- Configuration ---
const ARTWORKS_URL = "https://api.artic.edu/api/v1/artworks";
const CACHE_KEY = 'aicArtworksCache';
// Cache expiration time in milliseconds (1 hour = 60 * 60 * 1000)
const CACHE_DURATION = 60 * 60 * 1000;
let currentIndex = 0;
let isRevealed = false;
const artworkContanier = document.getElementById('artwork-container');
const imageContainer = document.getElementById('image-container');
const canvas = document.getElementById('textmode-canvas');

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
            //console.log(`Total artworks available: ${totalArtworks}`);
            return totalArtworks;
        }
    } catch (error) {
        console.error('An error occurred while fetching total artwork count:', error);
        return null;
    }
}

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
let charColorFixed = false;
const trail = [];
let lastMouse = null;
let imageUrl;

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
                    imageContainer.src = tempImageUrl;
                    renderImage(tempImageUrl, characters, getCharColorMode(), "fixed");
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

/*
t.draw(async () => {
    t.background(0);
    await renderImage(imageUrl, characters, getCharColorMode(), "fixed");
    
    for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i];
        p.age++;
        
        if (p.age >= p.maxAge) {
            trail.splice(i, 1);
            continue;
        }
        
        const life = 1 - (p.age / p.maxAge);
        const brightness = Math.round(255 * life);
        const chars = ["0", "1", "0", "1"];
        const idx = Math.floor(life * chars.length);
        
        t.push();
        t.charColor(brightness, brightness, brightness);
        t.translate(p.x, p.y);
        t.char(chars[Math.min(idx, chars.length - 1)]);
        t.point();
        t.pop();
    }
});
/*
t.mouseMoved((data) => {
    if (data.position.x === -1 || data.position.y === -1) return;
    
    // Convert to center-based coords
    const cx = Math.round(data.position.x - (t.grid.cols - 1) / 2);
    const cy = Math.round(data.position.y - (t.grid.rows - 1) / 2);
    
    // Spawn multiple particles based on movement speed
    const dx = lastMouse ? cx - lastMouse.x : 0;
    const dy = lastMouse ? cy - lastMouse.y : 0;
    const speed = Math.sqrt(dx * dx + dy * dy);
    const count = Math.max(1, Math.ceil(speed * 1.5));
    
    for (let i = 0; i < count; i++) {
        trail.push({ x: cx, y: cy, age: 0, maxAge: 15 + Math.random() * 10 });
    }
    
    lastMouse = { x: cx, y: cy };
});

t.mouseClicked((data) => {
    charColorFixed = !charColorFixed;
    console.log(`Clicked at grid position: ${data.position.x}, ${data.position.y}`);
    renderImage(imageUrl, characters, getCharColorMode(), "fixed");
});*/

// Handle WebGL context loss and restoration
t.canvas.addEventListener("webglcontextlost", handleContextLost, false);
t.canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

function handleContextLost(event) {
    // Prevent the default handling to allow context restoration
    event.preventDefault();
    console.warn("WebGL context lost - stopping render loop");
    t.noLoop();
}

function handleContextRestored(event) {
    window.location.reload();
    console.log("WebGL context restored - resuming render loop");
}

async function renderImage(imageUrl, characters, charColorMode, cellColorMode) {  
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
    myImage.charColor(255, 255, 255);
    
    // Set fixed cell background color (when cellColorMode is "fixed")
    myImage.cellColor(0, 0, 0);

    // Draw image at full grid size
    t.resizeCanvas(600, 600);
    t.image(myImage);
}

function getCharColorMode() {
    return charColorFixed ? "fixed" : "sampled";
}

function setIsRevealed(revealed) {
    isRevealed = revealed;

    if (revealed) {
        artworkContanier.style.display = "block";
    } else {
        artworkContanier.style.display = "none";
    }
}

document.getElementById('next-btn').addEventListener('click', async () => {
    const artworkData = await fetchArtworksAndCache();
    if (currentIndex < (artworkData.length - 1)) {
        currentIndex++;
    } else {
        currentIndex = 0;
    }
    setIsRevealed(false);
    renderArtworkData();
});

document.getElementById('color-btn').addEventListener('click', async () => {
    charColorFixed = !charColorFixed;
    renderImage(imageUrl, characters, getCharColorMode(), "fixed");
});

document.getElementById('reveal-btn').addEventListener('click', async () => {
    setIsRevealed(true);
});