# Vardhaman Sales Management

This project is a stock and sales tracking application for inventory management. It lets you:

- add products with quantity by office location
- update stock levels in real time
- edit product name, price, and packing details
- record sales to a specific customer/company per item
- keep sales history in a dedicated Sales tab
- view audit/change logs for modifications

## Project flow

The app is structured around a simple inventory lifecycle:

1. Add an item with name, price, box packing, and stock across three offices: Upper, Down, and Nagdevi.
2. The item sits in the main inventory table and stock can be adjusted directly from the table.
3. When a product is sold, you can open the sale action on that item, choose the location, quantity, customer, company, date, and price.
4. The selected stock branch is reduced automatically, and the sale is saved in a separate sales ledger.
5. The Sales tab shows all sold items with item name, customer, company, date, quantity, and total value.

## Local startup

Prerequisites:
- Node.js 18+
- A working Firebase project with the config already stored in `firebase-applet-config.json`

Steps:

1. Install dependencies:
   `npm install`
2. Start the app:
   `npm run dev`
3. Open the app in the browser:
   `http://localhost:3000`

## Notes

- Firebase auth is used for sign-in/state.
- Inventory and sales data are stored in Firestore collections.
- The app is already set up to run locally with the included Firebase configuration file in this project.
