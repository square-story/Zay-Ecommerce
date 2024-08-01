function showMessage(message, duration = 3000) {
  const snackbar = document.getElementById('snackbar');
  if (snackbar) {
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => {
      snackbar.classList.remove('show');
    }, duration);
  } else {
    console.error('Snackbar element not found'); // Debugging log
  }
}

function addToDb(productid, vIndex, isShop) {
  // Get the selected size value
  var selectedSize = document.querySelector('input[name="size"]:checked');
  let qunt = document.getElementById('quantity')?.value; // Use optional chaining for safety

  // Check if a size is selected
  if (selectedSize) {
    console.log('Selected size:', selectedSize.value);
    const data = {
      productId: productid,
      index: vIndex,
      size: selectedSize.value,
      quantity: qunt,
    };
    $.ajax({
      type: 'POST',
      url: '/add-cart',
      data: JSON.stringify(data),
      contentType: 'application/json',
      success: (response) => {
        console.log('Server response:', response); // Debugging log
        if (response.added) {
          showMessage('Item successfully added to your cart!');
        } else if (response.already) {
          showMessage('Item is already in the cart');
          setTimeout(() => {
            showMessage('Item successfully added to your cart!');
          }, 4000);
        } else if (response.user) {
          window.location.href = '/';
        }
      },
      error: (xhr, status, error) => {
        console.error('AJAX error:', error); // Debugging log for AJAX errors
      },
    });
  } else {
    // Show error message for size selection
    showError('Please select a size', productid, vIndex);
  }
}

function showError(message, productid, vIndex) {
  const sizeErrorElement = document.getElementById(
    'size-error-' + productid + '_' + vIndex
  );
  const size = document.getElementById('size');

  if (sizeErrorElement) {
    sizeErrorElement.textContent = message;
  }
  if (size) {
    size.style.color = 'red';
    size.textContent = message;
  }

  setTimeout(() => {
    if (sizeErrorElement) {
      sizeErrorElement.textContent = '';
    }
    if (size) {
      size.style.color = '';
      size.textContent = '';
    }
  }, 6000); // Clear the error message after 6 seconds
}

const addToCart = (productid, indexs = null, isShop = null) => {
  let index = '';
  if (indexs == null) {
    index = document.getElementById('productName').getAttribute('data-index');
    console.log(productid, index);
  } else {
    index = indexs;
  }
  try {
    $.ajax({
      type: 'POST',
      url: '/checkSession',
      success: (response) => {
        if (response.session) {
          console.log(true, 'yaaaaaaaaaaaa');
          addToDb(productid, index, isShop);
        } else {
          const product = [productid, index];
          localStorage.setItem('product', product);
        }
      },
    });
  } catch (error) {
    console.log(error);
  }
};

function proccedTOCheckOut() {
  try {
    const session = document.getElementById('btn').getAttribute('data-session');
    console.log(session);
    window.location = '/check-out';
  } catch (error) {
    console.log(error);
  }
}

function addTOWishlist(productId) {
  console.log('hello');
  const index = document
    .getElementById('productName')
    .getAttribute('data-index');
  const data = {
    productId,
    index,
  };
  $.ajax({
    type: 'POST',
    url: '/addWishlist',
    data: JSON.stringify(data),
    contentType: 'application/json',
    success: (response) => {
      if (response.already) {
        showMessage('Item is already in the wishlist');
        setTimeout(() => {
          showMessage('Item successfully added to your cart!');
        }, 4000);
      } else if (response.wishlist) {
        showMessage('Item successfully added to your wishlist!');
      }
    },
    error: (xhr, status, error) => {
      console.error('AJAX error:', error); // Debugging log for AJAX errors
    },
  });
}

function showToWish() {
  var x = document.getElementById('wishlist');
  x.className = 'show';
  setTimeout(function () {
    x.className = x.className.replace('show', '');
  }, 3000);
}

function removeFromWishlist(productId, index) {
  console.log('remove');
  try {
    if (!productId && !index) {
      return;
    }
    const data = {
      productId,
      index,
    };
    $.ajax({
      type: 'post',
      url: 'remove-wishlist',
      data: JSON.stringify(data),
      contentType: 'application/json',
      success: (response) => {
        if (response.success) {
          showMessage('Item successfully removed from your wishlist!');
          setTimeout(() => {
            window.location.reload();
          }, 3000); // Reload after 3 seconds to show the message
        }
      },
      error: (xhr, status, error) => {
        console.error('AJAX error:', error); // Debugging log for AJAX errors
      },
    });
  } catch (error) {
    console.log(error);
  }
}
