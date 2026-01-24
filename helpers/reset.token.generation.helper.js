export const generateResetToken = () => {
    return Math.random().toString(20).substring(2, 12); // Example for illustration
}