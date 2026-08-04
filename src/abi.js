export const abiToken = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "InvalidShortString",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "str",
                "type": "string"
            }
        ],
        "name": "StringTooLong",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "delegator",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "fromDelegate",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "toDelegate",
                "type": "address"
            }
        ],
        "name": "DelegateChanged",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "delegate",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "previousBalance",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newBalance",
                "type": "uint256"
            }
        ],
        "name": "DelegateVotesChanged",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [],
        "name": "EIP712DomainChanged",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "CLOCK_MODE",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "DOMAIN_SEPARATOR",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint32",
                "name": "pos",
                "type": "uint32"
            }
        ],
        "name": "checkpoints",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "uint32",
                        "name": "fromBlock",
                        "type": "uint32"
                    },
                    {
                        "internalType": "uint224",
                        "name": "votes",
                        "type": "uint224"
                    }
                ],
                "internalType": "struct ERC20Votes.Checkpoint",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "clock",
        "outputs": [
            {
                "internalType": "uint48",
                "name": "",
                "type": "uint48"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "subtractedValue",
                "type": "uint256"
            }
        ],
        "name": "decreaseAllowance",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "delegatee",
                "type": "address"
            }
        ],
        "name": "delegate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "delegatee",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "expiry",
                "type": "uint256"
            },
            {
                "internalType": "uint8",
                "name": "v",
                "type": "uint8"
            },
            {
                "internalType": "bytes32",
                "name": "r",
                "type": "bytes32"
            },
            {
                "internalType": "bytes32",
                "name": "s",
                "type": "bytes32"
            }
        ],
        "name": "delegateBySig",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "delegates",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "eip712Domain",
        "outputs": [
            {
                "internalType": "bytes1",
                "name": "fields",
                "type": "bytes1"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "version",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "chainId",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "verifyingContract",
                "type": "address"
            },
            {
                "internalType": "bytes32",
                "name": "salt",
                "type": "bytes32"
            },
            {
                "internalType": "uint256[]",
                "name": "extensions",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "enableTransfer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "timepoint",
                "type": "uint256"
            }
        ],
        "name": "getPastTotalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "timepoint",
                "type": "uint256"
            }
        ],
        "name": "getPastVotes",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "getVotes",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "addedValue",
                "type": "uint256"
            }
        ],
        "name": "increaseAllowance",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "nonces",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "numCheckpoints",
        "outputs": [
            {
                "internalType": "uint32",
                "name": "",
                "type": "uint32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
            },
            {
                "internalType": "uint8",
                "name": "v",
                "type": "uint8"
            },
            {
                "internalType": "bytes32",
                "name": "r",
                "type": "bytes32"
            },
            {
                "internalType": "bytes32",
                "name": "s",
                "type": "bytes32"
            }
        ],
        "name": "permit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "whitelisted",
                "type": "bool"
            }
        ],
        "name": "setWhitelist",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "transferEnabled",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "whitelist",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

export const OKXdex = [
  {
    "inputs": [],
    "name": "SafeTransferFailed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "newAdmin",
        "type": "address"
      }
    ],
    "name": "AdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "fromTokenAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "commissionAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "referrerAddress",
        "type": "address"
      }
    ],
    "name": "CommissionFromTokenRecord",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "toTokenAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "commissionAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "referrerAddress",
        "type": "address"
      }
    ],
    "name": "CommissionToTokenRecord",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "fromToken",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "toToken",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "fromAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "name": "OrderRecord",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "priorityAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "valid",
        "type": "bool"
      }
    ],
    "name": "PriorityAddressChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "SwapOrderId",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "_APPROVE_PROXY",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "_WETH",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "_WNATIVE_RELAY",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "admin",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "approveProxy",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "commissionRateLimit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeRateAndReceiver_UNUSED",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "operator_UNUSED",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "orderRemaining_UNUSED",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "priorityAddresses",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_priorityAddress",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "valid",
        "type": "bool"
      }
    ],
    "name": "setPriorityAddress",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_newAdmin",
        "type": "address"
      }
    ],
    "name": "setProtocolAdmin",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minReturnAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.BaseRequest",
        "name": "baseRequest",
        "type": "tuple"
      },
      {
        "internalType": "uint256[]",
        "name": "batchesAmount",
        "type": "uint256[]"
      },
      {
        "components": [
          {
            "internalType": "address[]",
            "name": "mixAdapters",
            "type": "address[]"
          },
          {
            "internalType": "address[]",
            "name": "assetTo",
            "type": "address[]"
          },
          {
            "internalType": "uint256[]",
            "name": "rawData",
            "type": "uint256[]"
          },
          {
            "internalType": "bytes[]",
            "name": "extraData",
            "type": "bytes[]"
          },
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.RouterPath[][]",
        "name": "batches",
        "type": "tuple[][]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "pathIndex",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "payer",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "fromToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "toTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "salt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isPushOrder",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "extension",
            "type": "bytes"
          }
        ],
        "internalType": "struct PMMLib.PMMSwapRequest[]",
        "name": "extraData",
        "type": "tuple[]"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "smartSwapByInvest",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minReturnAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.BaseRequest",
        "name": "baseRequest",
        "type": "tuple"
      },
      {
        "internalType": "uint256[]",
        "name": "batchesAmount",
        "type": "uint256[]"
      },
      {
        "components": [
          {
            "internalType": "address[]",
            "name": "mixAdapters",
            "type": "address[]"
          },
          {
            "internalType": "address[]",
            "name": "assetTo",
            "type": "address[]"
          },
          {
            "internalType": "uint256[]",
            "name": "rawData",
            "type": "uint256[]"
          },
          {
            "internalType": "bytes[]",
            "name": "extraData",
            "type": "bytes[]"
          },
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.RouterPath[][]",
        "name": "batches",
        "type": "tuple[][]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "pathIndex",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "payer",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "fromToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "toTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "salt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isPushOrder",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "extension",
            "type": "bytes"
          }
        ],
        "internalType": "struct PMMLib.PMMSwapRequest[]",
        "name": "extraData",
        "type": "tuple[]"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "refundTo",
        "type": "address"
      }
    ],
    "name": "smartSwapByInvestWithRefund",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minReturnAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.BaseRequest",
        "name": "baseRequest",
        "type": "tuple"
      },
      {
        "internalType": "uint256[]",
        "name": "batchesAmount",
        "type": "uint256[]"
      },
      {
        "components": [
          {
            "internalType": "address[]",
            "name": "mixAdapters",
            "type": "address[]"
          },
          {
            "internalType": "address[]",
            "name": "assetTo",
            "type": "address[]"
          },
          {
            "internalType": "uint256[]",
            "name": "rawData",
            "type": "uint256[]"
          },
          {
            "internalType": "bytes[]",
            "name": "extraData",
            "type": "bytes[]"
          },
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.RouterPath[][]",
        "name": "batches",
        "type": "tuple[][]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "pathIndex",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "payer",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "fromToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "toTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "salt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isPushOrder",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "extension",
            "type": "bytes"
          }
        ],
        "internalType": "struct PMMLib.PMMSwapRequest[]",
        "name": "extraData",
        "type": "tuple[]"
      }
    ],
    "name": "smartSwapByOrderId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minReturnAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.BaseRequest",
        "name": "baseRequest",
        "type": "tuple"
      },
      {
        "internalType": "uint256[]",
        "name": "batchesAmount",
        "type": "uint256[]"
      },
      {
        "components": [
          {
            "internalType": "address[]",
            "name": "mixAdapters",
            "type": "address[]"
          },
          {
            "internalType": "address[]",
            "name": "assetTo",
            "type": "address[]"
          },
          {
            "internalType": "uint256[]",
            "name": "rawData",
            "type": "uint256[]"
          },
          {
            "internalType": "bytes[]",
            "name": "extraData",
            "type": "bytes[]"
          },
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.RouterPath[][]",
        "name": "batches",
        "type": "tuple[][]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "pathIndex",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "payer",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "fromToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "toTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "salt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isPushOrder",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "extension",
            "type": "bytes"
          }
        ],
        "internalType": "struct PMMLib.PMMSwapRequest[]",
        "name": "extraData",
        "type": "tuple[]"
      }
    ],
    "name": "smartSwapByOrderIdByXBridge",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minReturnAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.BaseRequest",
        "name": "baseRequest",
        "type": "tuple"
      },
      {
        "internalType": "uint256[]",
        "name": "batchesAmount",
        "type": "uint256[]"
      },
      {
        "components": [
          {
            "internalType": "address[]",
            "name": "mixAdapters",
            "type": "address[]"
          },
          {
            "internalType": "address[]",
            "name": "assetTo",
            "type": "address[]"
          },
          {
            "internalType": "uint256[]",
            "name": "rawData",
            "type": "uint256[]"
          },
          {
            "internalType": "bytes[]",
            "name": "extraData",
            "type": "bytes[]"
          },
          {
            "internalType": "uint256",
            "name": "fromToken",
            "type": "uint256"
          }
        ],
        "internalType": "struct DexRouter.RouterPath[][]",
        "name": "batches",
        "type": "tuple[][]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "pathIndex",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "payer",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "fromToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "toToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fromTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "toTokenAmountMax",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "salt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadLine",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isPushOrder",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "extension",
            "type": "bytes"
          }
        ],
        "internalType": "struct PMMLib.PMMSwapRequest[]",
        "name": "extraData",
        "type": "tuple[]"
      }
    ],
    "name": "smartSwapTo",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "rawdata",
        "type": "uint256"
      }
    ],
    "name": "swapWrap",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "int256",
        "name": "amount0Delta",
        "type": "int256"
      },
      {
        "internalType": "int256",
        "name": "amount1Delta",
        "type": "int256"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "uniswapV3SwapCallback",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "receiver",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minReturn",
        "type": "uint256"
      },
      {
        "internalType": "uint256[]",
        "name": "pools",
        "type": "uint256[]"
      }
    ],
    "name": "uniswapV3SwapTo",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "receiver",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minReturn",
        "type": "uint256"
      },
      {
        "internalType": "uint256[]",
        "name": "pools",
        "type": "uint256[]"
      }
    ],
    "name": "uniswapV3SwapToByXBridge",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "receiver",
        "type": "uint256"
      },
      {
        "internalType": "contract IERC20",
        "name": "srcToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minReturn",
        "type": "uint256"
      },
      {
        "internalType": "uint256[]",
        "name": "pools",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes",
        "name": "permit",
        "type": "bytes"
      }
    ],
    "name": "uniswapV3SwapToWithPermit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "srcToken",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minReturn",
        "type": "uint256"
      },
      {
        "internalType": "bytes32[]",
        "name": "pools",
        "type": "bytes32[]"
      }
    ],
    "name": "unxswapByOrderId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "srcToken",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minReturn",
        "type": "uint256"
      },
      {
        "internalType": "bytes32[]",
        "name": "pools",
        "type": "bytes32[]"
      }
    ],
    "name": "unxswapByOrderIdByXBridge",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "srcToken",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minReturn",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32[]",
        "name": "pools",
        "type": "bytes32[]"
      }
    ],
    "name": "unxswapTo",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "returnAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "version",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "wNativeRelayer",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];

export const abiInvestmentProof = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "projectId_", "type": "uint256" },
      { "internalType": "address", "name": "investor_", "type": "address" }
    ],
    "name": "getInvestmentProof",
    "outputs": [
      { "internalType": "bytes32[]", "name": "proof", "type": "bytes32[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const abiCoinTerminalClaim =  [
  {
    "inputs": [
      { "internalType": "uint256", "name": "projectId_", "type": "uint256" },
      { "internalType": "bytes32[]", "name": "proof_", "type": "bytes32[]" }
    ],
    "name": "claimToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

export const abiLegacyFactory = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "tokenA",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "tokenB",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "stable",
                "type": "bool"
            }
        ],
        "name": "getPool",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export const abiSlipstreamFactory = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "tokenA",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "tokenB",
                "type": "address"
            },
            {
                "internalType": "int24",
                "name": "tickSpacing",
                "type": "int24"
            }
        ],
        "name": "getPool",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export const abiQuoter = [
    {
        "inputs": [
            {
                "internalType": "bytes",
                "name": "path",
                "type": "bytes"
            },
            {
                "internalType": "uint256",
                "name": "amountIn",
                "type": "uint256"
            }
        ],
        "name": "quoteExactInput",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "amountOut",
                "type": "uint256"
            },
            {
                "internalType": "uint160[]",
                "name": "",
                "type": "uint160[]"
            },
            {
                "internalType": "uint32[]",
                "name": "",
                "type": "uint32[]"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

export const abiMulticall3 = [
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "target",
                        "type": "address"
                    },
                    {
                        "internalType": "bool",
                        "name": "allowFailure",
                        "type": "bool"
                    },
                    {
                        "internalType": "bytes",
                        "name": "callData",
                        "type": "bytes"
                    }
                ],
                "internalType": "struct Multicall3.Call3[]",
                "name": "calls",
                "type": "tuple[]"
            }
        ],
        "name": "aggregate3",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "bool",
                        "name": "success",
                        "type": "bool"
                    },
                    {
                        "internalType": "bytes",
                        "name": "returnData",
                        "type": "bytes"
                    }
                ],
                "internalType": "struct Multicall3.Result[]",
                "name": "returnData",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    }
];

export const abiUniversalRouter = [
    {
        "inputs": [
            {
                "internalType": "bytes",
                "name": "commands",
                "type": "bytes"
            },
            {
                "internalType": "bytes[]",
                "name": "inputs",
                "type": "bytes[]"
            },
            {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
            }
        ],
        "name": "execute",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
];

export const uniswapAbi = [
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "permit2",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "weth9",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "v2Factory",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "v3Factory",
            "type": "address"
          },
          {
            "internalType": "bytes32",
            "name": "pairInitCodeHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "poolInitCodeHash",
            "type": "bytes32"
          },
          {
            "internalType": "address",
            "name": "v4PoolManager",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "v3NFTPositionManager",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "v4PositionManager",
            "type": "address"
          }
        ],
        "internalType": "struct RouterParameters",
        "name": "params",
        "type": "tuple"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "BalanceTooLow",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ContractLocked",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "Currency",
        "name": "currency",
        "type": "address"
      }
    ],
    "name": "DeltaNotNegative",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "Currency",
        "name": "currency",
        "type": "address"
      }
    ],
    "name": "DeltaNotPositive",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ETHNotAccepted",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "commandIndex",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "message",
        "type": "bytes"
      }
    ],
    "name": "ExecutionFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FromAddressIsNotOwner",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InputLengthMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientETH",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientToken",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "action",
        "type": "bytes4"
      }
    ],
    "name": "InvalidAction",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidBips",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "commandType",
        "type": "uint256"
      }
    ],
    "name": "InvalidCommandType",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidEthSender",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPath",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidReserves",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "LengthMismatch",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "NotAuthorizedForToken",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotPoolManager",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnlyMintAllowed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SliceOutOfBounds",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransactionDeadlinePassed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnsafeCast",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "action",
        "type": "uint256"
      }
    ],
    "name": "UnsupportedAction",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V2InvalidPath",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V2TooLittleReceived",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V2TooMuchRequested",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V3InvalidAmountOut",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V3InvalidCaller",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V3InvalidSwap",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V3TooLittleReceived",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V3TooMuchRequested",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "minAmountOutReceived",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amountReceived",
        "type": "uint256"
      }
    ],
    "name": "V4TooLittleReceived",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "maxAmountInRequested",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amountRequested",
        "type": "uint256"
      }
    ],
    "name": "V4TooMuchRequested",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "V3_POSITION_MANAGER",
    "outputs": [
      {
        "internalType": "contract INonfungiblePositionManager",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "V4_POSITION_MANAGER",
    "outputs": [
      {
        "internalType": "contract IPositionManager",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "commands",
        "type": "bytes"
      },
      {
        "internalType": "bytes[]",
        "name": "inputs",
        "type": "bytes[]"
      }
    ],
    "name": "execute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "commands",
        "type": "bytes"
      },
      {
        "internalType": "bytes[]",
        "name": "inputs",
        "type": "bytes[]"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "execute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "msgSender",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "poolManager",
    "outputs": [
      {
        "internalType": "contract IPoolManager",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "int256",
        "name": "amount0Delta",
        "type": "int256"
      },
      {
        "internalType": "int256",
        "name": "amount1Delta",
        "type": "int256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "uniswapV3SwapCallback",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "unlockCallback",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
]

export const quoterAbiV2 = [
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ],
        name: "params",
        type: "tuple"
      }
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
        inputs: [
            { internalType: 'bytes', name: 'path', type: 'bytes' },
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' }
        ],
        name: 'quoteExactInput',
        outputs: [
            {
                internalType: 'uint256',
                name: 'amountOut',
                type: 'uint256'
            },
            {
                internalType: 'uint160[]',
                name: 'sqrtPriceX96AfterList',
                type: 'uint160[]'
            },
            {
                internalType: 'uint32[]',
                name: 'initializedTicksCrossedList',
                type: 'uint32[]'
            },
            {
                internalType: 'uint256',
                name: 'gasEstimate',
                type: 'uint256'
            }
        ],
        stateMutability: 'nonpayable',
        type: 'function'
    },
];

export const factoryAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "tokenA", "type": "address" },
      { "internalType": "address", "name": "tokenB", "type": "address" },
      { "internalType": "uint24", "name": "fee", "type": "uint24" }
    ],
    "name": "getPool",
    "outputs": [
      { "internalType": "address", "name": "pool", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

export const v3PoolAbiMin = [
  { "inputs": [], "name": "liquidity", "outputs": [{ "internalType":"uint128","name":"","type":"uint128" }], "stateMutability":"view", "type":"function" },
  { "inputs": [], "name": "slot0", "outputs": [
      { "internalType":"uint160","name":"sqrtPriceX96","type":"uint160" },
      { "internalType":"int24","name":"tick","type":"int24" },
      { "internalType":"uint16","name":"observationIndex","type":"uint16" },
      { "internalType":"uint16","name":"observationCardinality","type":"uint16" },
      { "internalType":"uint16","name":"observationCardinalityNext","type":"uint16" },
      { "internalType":"uint8","name":"feeProtocol","type":"uint8" },
      { "internalType":"bool","name":"unlocked","type":"bool" }
  ], "stateMutability":"view", "type":"function" }
];

export const UNIVERSAL_ROUTER_ABI_MIN = [
  {
    "inputs": [
      { "internalType": "bytes", "name": "commands", "type": "bytes" },
      { "internalType": "bytes[]", "name": "inputs", "type": "bytes[]" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "name": "execute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

export const permit2Abi = [
  {
    "inputs": [
      {"internalType":"address","name":"user","type":"address"},
      {"internalType":"address","name":"token","type":"address"},
      {"internalType":"address","name":"spender","type":"address"}
    ],
    "name":"allowance",
    "outputs":[
      {"internalType":"uint160","name":"amount","type":"uint160"},
      {"internalType":"uint48","name":"expiration","type":"uint48"},
      {"internalType":"uint48","name":"nonce","type":"uint48"}
    ],
    "stateMutability":"view",
    "type":"function"
  },
  {
    "inputs": [
      {"internalType":"address","name":"token","type":"address"},
      {"internalType":"address","name":"spender","type":"address"},
      {"internalType":"uint160","name":"amount","type":"uint160"},
      {"internalType":"uint48","name":"expiration","type":"uint48"}
    ],
    "name":"approve",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  }
];

export const pancakeV3RouterAbi = [
    {
        inputs: [
            {
                components: [
                    {
                        internalType: 'bytes',
                        name: 'path',
                        type: 'bytes'
                    },
                    {
                        internalType: 'address',
                        name: 'recipient',
                        type: 'address'
                    },
                    {
                        internalType: 'uint256',
                        name: 'deadline',
                        type: 'uint256'
                    },
                    {
                        internalType: 'uint256',
                        name: 'amountIn',
                        type: 'uint256'
                    },
                    {
                        internalType: 'uint256',
                        name: 'amountOutMinimum',
                        type: 'uint256'
                    }
                ],
                internalType: 'struct ISwapRouter.ExactInputParams',
                name: 'params',
                type: 'tuple'
            }
        ],
        name: 'exactInput',
        outputs: [
            {
                internalType: 'uint256',
                name: 'amountOut',
                type: 'uint256'
            }
        ],
        stateMutability: 'payable',
        type: 'function'
    },
    {
        inputs: [
            {
                internalType: 'bytes[]',
                name: 'data',
                type: 'bytes[]'
            }
        ],
        name: 'multicall',
        outputs: [
            {
                internalType: 'bytes[]',
                name: 'results',
                type: 'bytes[]'
            }
        ],
        stateMutability: 'payable',
        type: 'function'
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: 'amountMinimum',
                type: 'uint256'
            },
            {
                internalType: 'address',
                name: 'recipient',
                type: 'address'
            }
        ],
        name: 'unwrapWETH9',
        outputs: [],
        stateMutability: 'payable',
        type: 'function'
    },
    {
        inputs: [],
        name: 'refundETH',
        outputs: [],
        stateMutability: 'payable',
        type: 'function'
    }
];

export const pancakeInfinityPoolManagerAbi = [
    {
        type: 'function',
        name: 'poolIdToPoolKey',
        stateMutability: 'view',

        inputs: [
            {
                name: 'id',
                type: 'bytes32'
            }
        ],

        outputs: [
            {
                name: 'currency0',
                type: 'address'
            },
            {
                name: 'currency1',
                type: 'address'
            },
            {
                name: 'hooks',
                type: 'address'
            },
            {
                name: 'poolManager',
                type: 'address'
            },
            {
                name: 'fee',
                type: 'uint24'
            },
            {
                name: 'parameters',
                type: 'bytes32'
            }
        ]
    }
];


export const pancakeInfinityCLInitializeEventAbi = {
    anonymous: false,
    type: 'event',
    name: 'Initialize',

    inputs: [
        {
            indexed: true,
            name: 'id',
            type: 'bytes32'
        },
        {
            indexed: true,
            name: 'currency0',
            type: 'address'
        },
        {
            indexed: true,
            name: 'currency1',
            type: 'address'
        },
        {
            indexed: false,
            name: 'hooks',
            type: 'address'
        },
        {
            indexed: false,
            name: 'fee',
            type: 'uint24'
        },
        {
            indexed: false,
            name: 'parameters',
            type: 'bytes32'
        },
        {
            indexed: false,
            name: 'sqrtPriceX96',
            type: 'uint160'
        },
        {
            indexed: false,
            name: 'tick',
            type: 'int24'
        }
    ]
};


export const pancakeInfinityBinInitializeEventAbi = {
    anonymous: false,
    type: 'event',
    name: 'Initialize',

    inputs: [
        {
            indexed: true,
            name: 'id',
            type: 'bytes32'
        },
        {
            indexed: true,
            name: 'currency0',
            type: 'address'
        },
        {
            indexed: true,
            name: 'currency1',
            type: 'address'
        },
        {
            indexed: false,
            name: 'hooks',
            type: 'address'
        },
        {
            indexed: false,
            name: 'fee',
            type: 'uint24'
        },
        {
            indexed: false,
            name: 'parameters',
            type: 'bytes32'
        },
        {
            indexed: false,
            name: 'activeId',
            type: 'uint24'
        }
    ]
};

/*
 * LegionTokenDistributor minimal ABI.
 *
 * Keep this intentionally small. A future Legion contract version with a
 * different selector or tuple layout must fail validation instead of being
 * accepted automatically.
 */
export const legionTokenDistributorAbi = [
    {
        type: 'function',
        name: 'claimTokenAllocation',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'claimAmount',
                type: 'uint256'
            },
            {
                name: 'investorVestingConfig',
                type: 'tuple',
                components: [
                    { name: 'vestingStartTime', type: 'uint64' },
                    { name: 'vestingDurationSeconds', type: 'uint64' },
                    { name: 'vestingCliffDurationSeconds', type: 'uint64' },
                    { name: 'vestingType', type: 'uint8' },
                    { name: 'epochDurationSeconds', type: 'uint64' },
                    { name: 'numberOfEpochs', type: 'uint64' },
                    { name: 'tokenAllocationOnTGERate', type: 'uint64' }
                ]
            },
            {
                name: 'claimSignature',
                type: 'bytes'
            },
            {
                name: 'vestingSignature',
                type: 'bytes'
            }
        ],
        outputs: []
    },
    {
        type: 'function',
        name: 'distributorConfiguration',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'legionFeeOnTokensSoldBps', type: 'uint16' },
                    { name: 'referrerFeeOnTokensSoldBps', type: 'uint16' },
                    { name: 'tokensSupplied', type: 'bool' },
                    { name: 'totalAmountToDistribute', type: 'uint256' },
                    { name: 'totalAmountClaimed', type: 'uint256' },
                    { name: 'askToken', type: 'address' },
                    { name: 'projectAdmin', type: 'address' },
                    { name: 'legionBouncer', type: 'address' },
                    { name: 'legionFeeReceiver', type: 'address' },
                    { name: 'referrerFeeReceiver', type: 'address' },
                    { name: 'legionSigner', type: 'address' },
                    { name: 'addressRegistry', type: 'address' }
                ]
            }
        ]
    },
    {
        type: 'function',
        name: 'investorPosition',
        stateMutability: 'view',
        inputs: [
            { name: 'investor', type: 'address' }
        ],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'hasSettled', type: 'bool' },
                    { name: 'vestingAddress', type: 'address' }
                ]
            }
        ]
    },
    {
        type: 'function',
        name: 'paused',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: '', type: 'bool' }
        ]
    },
    {
        type: 'event',
        name: 'TokenAllocationClaimed',
        anonymous: false,
        inputs: [
            { indexed: false, name: 'amountToBeVested', type: 'uint256' },
            { indexed: false, name: 'amountOnClaim', type: 'uint256' },
            { indexed: false, name: 'investor', type: 'address' }
        ]
    }
];

export const legionClaimErc20Abi = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [
            { name: 'account', type: 'address' }
        ],
        outputs: [
            { name: '', type: 'uint256' }
        ]
    },
    {
        type: 'event',
        name: 'Transfer',
        anonymous: false,
        inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
        ]
    }
];

export const legionTokenDistributorFactoryEventAbi = {
    type: 'event',
    name: 'NewTokenDistributorCreated',
    anonymous: false,
    inputs: [
        {
            indexed: false,
            name: 'distributorInstance',
            type: 'address'
        },
        {
            indexed: false,
            name: 'distributorInitParams',
            type: 'tuple',
            components: [
                { name: 'legionFeeOnTokensSoldBps', type: 'uint16' },
                { name: 'referrerFeeOnTokensSoldBps', type: 'uint16' },
                { name: 'referrerFeeReceiver', type: 'address' },
                { name: 'askToken', type: 'address' },
                { name: 'addressRegistry', type: 'address' },
                { name: 'projectAdmin', type: 'address' },
                { name: 'totalAmountToDistribute', type: 'uint256' }
            ]
        }
    ]
};
