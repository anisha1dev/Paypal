const paypal = require('paypal-rest-sdk');
const fs = require('fs');
const path = require('path');

const { PAYPAL_MODE, PAYPAL_CLIENT_KEY, PAYPAL_SECRET_KEY } = process.env;

paypal.configure({
  mode: PAYPAL_MODE,
  client_id: PAYPAL_CLIENT_KEY,
  client_secret: PAYPAL_SECRET_KEY
});

// Load products
const productsFile = path.join(__dirname, '../data/products.json');
const products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));

const renderBuyPage = async (req, res) => {
  try {
    res.render('index', { products });
  } catch (error) {
    console.log(error.message);
  }
};

const payProduct = async (req, res) => {
  try {
    const productId = req.body.productId;
    const product = products.find(p => p.id === productId);
    if (!product) return res.send('Product not found.');

    // Get protocol and host dynamically
    const protocol = req.protocol;             // http or https
    const host = req.get('host');              // localhost:3000 or your domain
    const baseUrl = `${protocol}://${host}`;   // e.g., http://localhost:3000

    const create_payment_json = {
      intent: "sale",
      payer: { payment_method: "paypal" },
      redirect_urls: {
        return_url: `${baseUrl}/success`,
        cancel_url: `${baseUrl}/cancel?productName=${encodeURIComponent(product.name)}`
      },
      transactions: [{
        item_list: { items: [{
          name: product.name,
          sku: product.id,
          price: product.price,
          currency: product.currency,
          quantity: 1
        }]},
        amount: { currency: product.currency, total: product.price },
        description: product.description
      }]
    };

    paypal.payment.create(create_payment_json, (error, payment) => {
      if (error) throw error;
      const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
      res.redirect(approvalUrl.href);
    });

  } catch (error) {
    console.log(error.message);
    res.send("Payment could not be processed");
  }
};


const successPage = async (req, res) => {
  try {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;

    // First, get payment to find the amount dynamically
    paypal.payment.get(paymentId, (err, payment) => {
      if (err) return res.send("Error retrieving payment details");

      const transaction = payment.transactions[0];
      const amount = transaction.amount.total;
      const currency = transaction.amount.currency;

      const execute_payment_json = {
        payer_id: payerId,
        transactions: [{
          amount: { total: amount, currency: currency }
        }]
      };

      // ✅ Execute the payment — this is when money is deducted
      paypal.payment.execute(paymentId, execute_payment_json, (err2, executedPayment) => {
        if (err2) {
          console.error(err2.response);
          return res.send("Error executing payment");
        }

        const item = transaction.item_list.items[0];
        const productName = item.name;
        const productPrice = item.price;
        const payerName = executedPayment.payer.payer_info.first_name + " " + executedPayment.payer.payer_info.last_name;
        const payerEmail = executedPayment.payer.payer_info.email;

        res.render('success', {
          productName,
          productPrice,
          currency,
          payerName,
          payerEmail,
          paymentId
        });
      });
    });
  } catch (error) {
    console.log(error.message);
    res.send("Something went wrong");
  }
};



const cancelPage = async (req, res) => {
  try {
    // Optional: get product name from query string
    const productName = req.query.productName || null;
    res.render('cancel', { productName });
  } catch (error) {
    console.log(error.message);
    res.send("Something went wrong");
  }
};

module.exports = {
  renderBuyPage,
  payProduct,
  successPage,
  cancelPage
};
