// SPDX-License-Identifier: MIT
pragma solidity ^0.5.0;

contract BorrowingContract {
    address payable public borrowerAddress;
    address payable public lenderAddress;
    address public borrowingContractAddress;
    address public lendingContractAddress;
    address public loanManagementContractAddress;

    uint public loanAmount;
    uint public interestRate;
    uint public totalRepayableAmount;
    uint public dueDate;
    bool public isFunded;
    bool public isRepaid;

    struct CollateralProduct {
        string name;
        uint value;
        address owner;
    }

    CollateralProduct public collateral;
    bool public isCollateralClaimed;

    constructor(
        address _borrower,
        uint _loanAmount,
        uint _ltv,
        uint _dueDate,
        address _lendingContractAddress,
        string memory _productName,
        uint _productValue
    ) public {
        borrowerAddress = address(uint160(_borrower));
        borrowingContractAddress = address(this);
        loanManagementContractAddress = msg.sender;
        lendingContractAddress = _lendingContractAddress;
        loanAmount = _loanAmount;
        interestRate = setInterestRate(_ltv);
        totalRepayableAmount = loanAmount + ((loanAmount * interestRate) / 100);
        dueDate = setLoanTerm(_dueDate);
        isFunded = false;
        isRepaid = false;

        collateral = CollateralProduct({
            name: _productName,
            value: _productValue,
            owner: _borrower
        });
        isCollateralClaimed = false;
    }

    function setLender(address _lenderAddress) external {
        require(
            _lenderAddress != borrowerAddress,
            "BC: Borrower cannot be the lender"
        );
        require(
            lenderAddress == address(0),
            "BC: Lender already set, cannot change lender address"
        );
        lenderAddress = address(uint160(_lenderAddress));
        isFunded = true;
    }

    function repayLoan(address _borrower) external payable {
        require(
            msg.sender == loanManagementContractAddress,
            "BC: Unauthorized function call from LoanManagement"
        );
        require(
            _borrower == borrowerAddress,
            "BC: Only borrower can repay loan"
        );
        require(
            msg.value == totalRepayableAmount,
            "BC: Incorrect funding amount"
        );
        require(isFunded, "BC: Loan is not funded");

        require(
            block.timestamp <= dueDate,
            "BC: Loan term has already expired"
        );
        lenderAddress.transfer(msg.value);
        isRepaid = true;
    }

    function claimCollateral(address _lender) external {
        require(
            lenderAddress == _lender,
            "BC: Only lender can claim collateral"
        );
        require(!isRepaid, "BC: Loan is already repaid");
        require(block.timestamp > dueDate, "BC: Loan term has not expired yet");

        collateral.owner = lenderAddress;
        isCollateralClaimed = true;
    }

    function setInterestRate(uint _ltv) internal pure returns (uint) {
        require(
            _ltv == 25 || _ltv == 50 || _ltv == 70,
            "BC: Invalid LTV option (only 25,50, or 70)"
        );
        return _ltv == 25 ? 5 : (_ltv == 50 ? 9 : 12);
    }

    function setLoanTerm(uint loanTermDays) internal view returns (uint) {
        require(
            loanTermDays == 0 || loanTermDays == 30 || loanTermDays == 365,
            "BC: Invalid loan term (only 0, 30, 365 days)"
        );
        return
            loanTermDays == 0
                ? block.timestamp - (30 * 24 * 60 * 60) // 30 days ago
                : block.timestamp + (loanTermDays * 1 days);
    }

    function getSummary()
        external
        view
        returns (
            address _borrower,
            address _lender,
            address _borrowingContractAddress,
            address _lendingContractAddress,
            uint _amount,
            uint _interestRate,
            uint _dueDate,
            uint _totalRepayableAmount,
            bool _isFunded,
            bool _isRepaid
        )
    {
        return (
            borrowerAddress,
            lenderAddress,
            borrowingContractAddress,
            lendingContractAddress,
            loanAmount,
            interestRate,
            dueDate,
            totalRepayableAmount,
            isFunded,
            isRepaid
        );
    }

    function getCollateralName() external view returns (string memory) {
        return collateral.name;
    }

    function getCollateralValue() external view returns (uint) {
        return collateral.value;
    }

    function getCollateralOwner() external view returns (address) {
        return collateral.owner;
    }
}
