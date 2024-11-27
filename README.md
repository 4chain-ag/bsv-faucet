## For any GitHub user

### How to request for top up

- open an issue tab in this repository.
- click the button "New issue".
- Find a "Top-Up Request" template and click "Get started" button.
- Keep the title as is (or at least don't remove provided title)
- Fill the description according to instruction (generally speaking just replace a placeholder with your BSV address)
- Click "Submit new issue" button.
- Wait for automatic validation of the issue
- Wait for someone to approve your request
- Follow the instructions provided in comments.


## For Users with write access to this repository
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
