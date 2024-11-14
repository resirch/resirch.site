// blacksmithingScript.js

let items = []; // This will hold the items loaded from the JSON file

// Load counts from localStorage
let userCounts = JSON.parse(localStorage.getItem('userCounts')) || {};

// Load selected item from localStorage
let selectedItemName = localStorage.getItem('selectedItemName') || '';

// Load favorites from localStorage
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Fetch the items from the JSON file
fetch('/blacksmithingItems.json')
    .then(response => response.json())
    .then(data => {
        items = data;
        populateDropdown();
        populateFavorites();
        // If a selected item is saved, display its requirements
        if (selectedItemName) {
            displayRequirements(selectedItemName);
            itemSearch.value = selectedItemName;
            updateFavoriteButton(); // Update favorite button state
        }
    })
    .catch(error => console.error('Error loading items:', error));

// Populate the dropdown
const itemSelect = document.getElementById('item-select');
const itemSearch = document.getElementById('item-search');
const dropdownContainer = document.getElementById('dropdown-container');
const favoriteButton = document.getElementById('favorite-button');

// Function to populate the dropdown
function populateDropdown(filterText = '') {
    // Clear the current options
    itemSelect.innerHTML = '';
    // Filter items based on search text
    const filteredItems = items.filter(item => item['Item Name'].toLowerCase().includes(filterText.toLowerCase()));
    // Show up to 5 results
    const displayItems = filteredItems.slice(0, 5);
    displayItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item['Item Name'];
        option.textContent = item['Item Name'];
        itemSelect.appendChild(option);
    });
    // Automatically select the first item
    if (displayItems.length > 0) {
        itemSelect.selectedIndex = 0;
        // If user is typing, don't auto-select unless it's the exact match
        if (filterText.toLowerCase() === displayItems[0]['Item Name'].toLowerCase()) {
            displayRequirements(displayItems[0]['Item Name']);
            selectedItemName = displayItems[0]['Item Name'];
            saveSelectedItem();
            updateFavoriteButton();
        }
    } else {
        document.getElementById('item-requirements').innerHTML = '';
    }
}

// Handle search
itemSearch.addEventListener('input', function() {
    if (this.value.trim() === '') {
        itemSelect.classList.remove('show');
    } else {
        itemSelect.classList.add('show');
    }
    populateDropdown(this.value);
});

// Hide dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (!dropdownContainer.contains(event.target) && event.target !== itemSearch) {
        itemSelect.classList.remove('show');
    }
});

// Handle item selection
itemSelect.addEventListener('change', function() {
    displayRequirements(this.value);
    selectedItemName = this.value;
    saveSelectedItem();
    updateFavoriteButton();
    itemSelect.classList.remove('show');
    itemSearch.value = this.value;
});

// Handle selection via clicking on options
itemSelect.addEventListener('click', function() {
    if (itemSelect.selectedIndex >= 0) {
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        displayRequirements(selectedOption.value);
        selectedItemName = selectedOption.value;
        saveSelectedItem();
        updateFavoriteButton();
        itemSelect.classList.remove('show');
        itemSearch.value = selectedOption.value;
    }
});

// Function to display the requirements
function displayRequirements(itemName) {
    const item = items.find(i => i['Item Name'] === itemName);
    const requirementsDiv = document.getElementById('item-requirements');
    requirementsDiv.innerHTML = ''; // Clear previous content
    if (item && item['Smithing Requirements']) {
        item['Smithing Requirements'].forEach(req => {
            const materialDiv = document.createElement('div');
            materialDiv.className = 'material';
            const materialName = req['Material'];
            const requiredQuantity = req['Quantity'];
            const userQuantity = userCounts[itemName] && userCounts[itemName][materialName] ? userCounts[itemName][materialName] : 0;

            materialDiv.innerHTML = `
                <div class="material-name">${materialName}</div>
                <div class="material-controls">
                    <button class="decrement" data-material="${materialName}" data-required="${requiredQuantity}">-</button>
                    <span class="quantity">${userQuantity}/${requiredQuantity}</span>
                    <button class="increment" data-material="${materialName}" data-required="${requiredQuantity}">+</button>
                    <button class="material-clear-button" data-material="${materialName}">&times;</button>
                </div>
            `;
            requirementsDiv.appendChild(materialDiv);
        });

        // Add event listeners to + and - buttons
        const incrementButtons = requirementsDiv.querySelectorAll('.increment');
        incrementButtons.forEach(button => {
            button.addEventListener('click', function() {
                const material = this.getAttribute('data-material');
                const requiredQuantity = parseInt(this.getAttribute('data-required'));
                incrementMaterial(material, itemName, requiredQuantity);
            });
        });

        const decrementButtons = requirementsDiv.querySelectorAll('.decrement');
        decrementButtons.forEach(button => {
            button.addEventListener('click', function() {
                const material = this.getAttribute('data-material');
                decrementMaterial(material, itemName);
            });
        });

        // Add event listeners to Clear buttons
        const clearButtons = requirementsDiv.querySelectorAll('.material-clear-button');
        clearButtons.forEach(button => {
            button.addEventListener('click', function() {
                const material = this.getAttribute('data-material');
                clearMaterial(material, itemName);
            });
        });
    }
}

// Function to increment material count
function incrementMaterial(materialName, itemName, requiredQuantity) {
    if (!userCounts[itemName]) {
        userCounts[itemName] = {};
    }
    if (!userCounts[itemName][materialName]) {
        userCounts[itemName][materialName] = 0;
    }
    if (userCounts[itemName][materialName] < requiredQuantity) {
        userCounts[itemName][materialName]++;
        saveCounts();
        displayRequirements(itemName);
    }
}

// Function to decrement material count
function decrementMaterial(materialName, itemName) {
    if (userCounts[itemName] && userCounts[itemName][materialName] > 0) {
        userCounts[itemName][materialName]--;
        saveCounts();
        displayRequirements(itemName);
    }
}

// Function to clear material count
function clearMaterial(materialName, itemName) {
    if (userCounts[itemName]) {
        userCounts[itemName][materialName] = 0;
        saveCounts();
        displayRequirements(itemName);
    }
}

// Function to save counts to localStorage
function saveCounts() {
    localStorage.setItem('userCounts', JSON.stringify(userCounts));
}

// Function to save selected item to localStorage
function saveSelectedItem() {
    localStorage.setItem('selectedItemName', selectedItemName);
}

// Handle Clear All Counts button
document.getElementById('clear-all').addEventListener('click', function() {
    if (userCounts[selectedItemName]) {
        userCounts[selectedItemName] = {};
        saveCounts();
        displayRequirements(selectedItemName);
    }
});

// Handle Favorite button
favoriteButton.addEventListener('click', function() {
    if (selectedItemName) {
        if (favorites.includes(selectedItemName)) {
            // Remove from favorites
            favorites = favorites.filter(item => item !== selectedItemName);
        } else {
            // Add to favorites
            favorites.push(selectedItemName);
        }
        saveFavorites();
        populateFavorites();
        updateFavoriteButton();
    }
});

// Function to update the favorite button appearance
function updateFavoriteButton() {
    if (selectedItemName && favorites.includes(selectedItemName)) {
        favoriteButton.classList.add('favorited');
        favoriteButton.textContent = 'Unfavorite';
    } else {
        favoriteButton.classList.remove('favorited');
        favoriteButton.textContent = 'Favorite';
    }
}

// Function to save favorites to localStorage
function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Function to populate the favorites list
function populateFavorites() {
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = '';
    favorites.forEach(favItemName => {
        const li = document.createElement('li');
        li.textContent = favItemName;
        li.addEventListener('click', function() {
            selectedItemName = favItemName;
            saveSelectedItem();
            displayRequirements(favItemName);
            itemSearch.value = favItemName;
            updateFavoriteButton();
            itemSelect.classList.remove('show');
        });
        favoritesList.appendChild(li);
    });
}
