// SPDX-License-Identifier: MIT
pragma solidity ^0.5.0;

contract PoolLendingContract {
    address public lenderAddress;
    address public lendingContractAddress;
    address public loanManagementContractAddress;
    uint public totalFunds;
    uint public availableFunds;
    uint public numLoans;

    constructor(address _lenderAddress) public payable {
        lenderAddress = _lenderAddress;
        totalFunds = msg.value;
        availableFunds = msg.value;
        numLoans = 0;
        loanManagementContractAddress = msg.sender;
        lendingContractAddress = address(this);
    }

    function lendFunds(address _borrower, uint _amount) external {
        require(
            msg.sender == loanManagementContractAddress,
            "PLC: Unauthorized Loan Manager"
        );
        require(_amount <= availableFunds, "PLC: Not enough available funds");

        availableFunds = availableFunds - _amount;
        address payable borrowerPayable = address(uint160(_borrower));
        borrowerPayable.transfer(_amount);
        numLoans++;
    }

    function getSummary()
        public
        view
        returns (
            address _lenderAddress,
            address _lendingContractAddress,
            uint _totalFunds,
            uint _availableFunds
        )
    {
        return (
            lenderAddress,
            lendingContractAddress,
            totalFunds,
            availableFunds
        );
    }
}
