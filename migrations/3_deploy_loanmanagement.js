const LoanManagementContract = artifacts.require("LoanManagementContract");

module.exports = function (deployer) {
    deployer.deploy(LoanManagementContract);
};
