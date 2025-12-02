// Cache for card prices and URLs to avoid repeated API calls
const priceCache = {};

// Function to fetch cheapest card price and URL from Scryfall API
async function getCardPrice(cardName) {
  if (priceCache[cardName]) {
    return priceCache[cardName];
  }

  try {
    const searchUrl = `https://api.scryfall.com/cards/search?unique=prints&q=!"${encodeURIComponent(cardName)}"`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.data?.length) {
      return null;
    }

    // Find the cheapest printing across all price types
    let cheapestPrice = null;
    let cheapestUrl = null;
    let scryfallUrl = null;
    
    for (const card of data.data) {
      // Store the first Scryfall URL we find for the card page link
      if (!scryfallUrl) {
        scryfallUrl = card.scryfall_uri;
      }
      
      const prices = [
        { value: card.prices?.usd, url: card.purchase_uris?.tcgplayer || card.scryfall_uri },
        { value: card.prices?.usd_foil, url: card.purchase_uris?.tcgplayer || card.scryfall_uri },
        { value: card.prices?.usd_etched, url: card.purchase_uris?.tcgplayer || card.scryfall_uri }
      ];
      
      for (const { value, url } of prices) {
        if (value) {
          const price = parseFloat(value);
          if (!isNaN(price) && (cheapestPrice === null || price < cheapestPrice)) {
            cheapestPrice = price;
            cheapestUrl = url;
          }
        }
      }
    }
    
    // Generate EDHREC URL (format: card-name with hyphens)
    const edhrecUrl = `https://edhrec.com/cards/${cardName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    
    const result = { 
      price: cheapestPrice, 
      purchaseUrl: cheapestUrl,
      scryfallUrl: scryfallUrl,
      edhrecUrl: edhrecUrl
    };
    priceCache[cardName] = result;
    return result;
  } catch (error) {
    console.error(`Moxfield Pricer - Error fetching price for "${cardName}":`, error);
    return null;
  }
}

// Extract card name from element
function getCardName(element) {
  let cardName = null;
  
  // Check if element itself is an img
  if (element.tagName === 'IMG') {
    cardName = element.alt || element.title || element.dataset.name;
  }
  
  // Check for nested img
  if (!cardName) {
    const img = element.querySelector('img');
    if (img) {
      cardName = img.alt || img.title || img.dataset.name;
    }
  }
  
  // Check for name elements
  if (!cardName) {
    const nameElement = element.querySelector('[class*="name"], [class*="card-name"]') ||
                        element.parentElement?.querySelector('[class*="name"]');
    cardName = nameElement?.textContent.trim();
  }
  
  // Filter out invalid card names
  const invalidNames = ['front', 'back', 'transform'];
  if (cardName && invalidNames.includes(cardName.toLowerCase())) {
    return null;
  }
  
  return cardName;
}

// Add price display under card image
async function addPriceToCard(cardElement) {
  if (cardElement.dataset.priceAdded) return;
  
  cardElement.dataset.priceAdded = 'true';
  
  const cardName = getCardName(cardElement);
  if (!cardName) return;

  const result = await getCardPrice(cardName);
  
  if (result?.price) {
    // Create container for all links
    const linksContainer = document.createElement('div');
    linksContainer.className = 'moxfield-card-links';
    
    // Create price link (purchase link)
    const priceLink = document.createElement('a');
    priceLink.href = result.purchaseUrl;
    priceLink.target = '_blank';
    priceLink.rel = 'noopener noreferrer';
    priceLink.className = 'moxfield-card-price';
    priceLink.textContent = `$${result.price.toFixed(2)}`;
    linksContainer.appendChild(priceLink);
    
    // Create Scryfall link
    if (result.scryfallUrl) {
      const scryfallLink = document.createElement('a');
      scryfallLink.href = result.scryfallUrl;
      scryfallLink.target = '_blank';
      scryfallLink.rel = 'noopener noreferrer';
      scryfallLink.className = 'moxfield-card-link';
      scryfallLink.textContent = 'Scryfall';
      linksContainer.appendChild(scryfallLink);
    }
    
    // Create EDHREC link
    if (result.edhrecUrl) {
      const edhrecLink = document.createElement('a');
      edhrecLink.href = result.edhrecUrl;
      edhrecLink.target = '_blank';
      edhrecLink.rel = 'noopener noreferrer';
      edhrecLink.className = 'moxfield-card-link';
      edhrecLink.textContent = 'EDHREC';
      linksContainer.appendChild(edhrecLink);
    }
    
    if (cardElement.parentElement) {
      cardElement.parentElement.insertBefore(linksContainer, cardElement.nextSibling);
    } else {
      cardElement.appendChild(linksContainer);
    }
  }
}

// Check if spoiler view mode is selected
function isSpoilerViewMode() {
  const viewModeElement = document.getElementById("viewMode");
  
  if (!viewModeElement) {
    return false; // Return false if element doesn't exist yet
  }
  
  const viewModeSelected = viewModeElement.value;
  
  // Check if the selected text is 'spoiler'
  return viewModeSelected === 'spoiler';
}

// Process all cards in view
function processCards() {
  // Only process if in spoiler view mode
  if (!isSpoilerViewMode()) {
    return;
  }
  
  const cardElements = document.querySelectorAll('.img-card:not([data-price-added])');
  cardElements.forEach(addPriceToCard);
}

// Observer for dynamically loaded cards
const observer = new MutationObserver(() => {
  clearTimeout(observer.timeout);
  observer.timeout = setTimeout(processCards, 300);
});

// Initialize extension
function init() {
  // Wait 2 seconds before first check to ensure page is fully loaded
  setTimeout(() => {
    processCards();
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }, 2000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}