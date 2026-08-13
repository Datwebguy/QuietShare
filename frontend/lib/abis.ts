// Keep in sync with contracts/contracts/*.sol and fce-extension/contracts/*.sol.

export const MOCK_STABLE_ABI = [
  "function faucet() external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export const POT_VAULT_ABI = [
  "function createPot(bytes32 potId, address token) external",
  "function joinPot(bytes32 potId) external",
  "function deposit(bytes32 potId, uint256 amount, bytes calldata encryptedNote) external",
  "function members(bytes32 potId) view returns (address[])",
  "function isMember(bytes32 potId, address account) view returns (bool)",
  "function potBalance(bytes32 potId) view returns (uint256)",
  "function pots(bytes32 potId) view returns (address creator, address token, bool exists)",
  "function proposeSpend(bytes32 potId, address to, uint256 amount, string calldata memo) external returns (bytes32 proposalId)",
  "function approveSpend(bytes32 proposalId) external",
  "event PotCreated(bytes32 indexed potId, address indexed creator, address token)",
  "event Deposited(bytes32 indexed potId, address indexed depositor, uint256 amount, bytes encryptedNote)",
  "event SpendProposed(bytes32 indexed potId, bytes32 indexed proposalId, address indexed proposer, address to, uint256 amount, string memo)",
  "event SpendApproved(bytes32 indexed proposalId, address indexed approver, uint256 approvalCount)",
  "event SpendExecuted(bytes32 indexed proposalId, address indexed to, uint256 amount)"
];

export const USERNAME_REGISTRY_ABI = [
  "function nameOf(address) view returns (string)",
  "function setName(string calldata name) external"
];

export const INSTRUCTION_SENDER_ABI = [
  "function setExtensionId() external",
  "function sendRecordDeposit(bytes32 potId, bytes calldata encryptedNote) external payable",
  "function sendGetBalance(bytes32 potId) external payable returns (bytes32 instructionId)"
];
