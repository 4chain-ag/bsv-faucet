### How to request for top up


- Add a json file in root of this repository with your username as a filename (e.g. `username.json`).
- The json file should contain the following structure:
```json
{
  "address": "your_BSV_address"
}
```
- Create a pull request with this json file.
- After approving it and merging the process will be started to make a transaction to your address.
- When the transaction will be made you will find in your json file a hex of tx, and a vout which is an index of output for your address.
