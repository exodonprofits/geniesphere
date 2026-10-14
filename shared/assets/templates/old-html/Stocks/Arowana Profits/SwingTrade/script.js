document.getElementById('strategyForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const stockSymbol = document.getElementById('stockSymbol').value.toUpperCase();
    const timeFrame = parseInt(document.getElementById('timeFrame').value);
    const riskTolerance = document.getElementById('riskTolerance').value;

    const strategy = generateStrategy(stockSymbol, timeFrame, riskTolerance);

    const resultDiv = document.getElementById('strategyResult');
    resultDiv.innerHTML = `
        <h2>${stockSymbol} Swing Trading Strategy</h2>
        <div class="strategy-detail">
            <p><strong>Time Frame:</strong> ${timeFrame} days</p>
            <p><strong>Risk Profile:</strong> ${riskTolerance.charAt(0).toUpperCase() + riskTolerance.slice(1)}</p>
            <h3>Recommended Strategy</h3>
            ${strategy}
        </div>
    `;
});

function generateStrategy(symbol, days, risk) {
    let strategy = [];
    
    // Base strategy components
    const baseEntry = `Look for entry opportunities in ${symbol} when:`;
    const baseExit = `Consider exiting when:`;
    
    // Technical indicators based on time frame
    const indicators = {
        mainIndicator: days <= 5 ? '5-period EMA' : 
                       days <= 10 ? '10-period SMA' : '20-period SMA',
        secondaryIndicator: days <= 10 ? 'RSI (2-period)' : 'RSI (14-period)',
        volatilityMeasure: days <= 5 ? 'ATR (14-period)' : 'Bollinger Bands'
    };

    // Risk management configuration
    const riskManagement = {
        low: { stopLoss: '2-3%', positionSize: '1-2% of capital', maxHold: days + 2 },
        medium: { stopLoss: '4-5%', positionSize: '3-4% of capital', maxHold: days + 3 },
        high: { stopLoss: '6-7%', positionSize: '5-6% of capital', maxHold: days + 5 }
    };

    // Strategy components
    strategy.push(`<p>${baseEntry}</p><ul>
        <li>Price pulls back to ${indicators.mainIndicator}</li>
        <li>${indicators.secondaryIndicator} shows ${days <= 10 ? 'oversold (<30)' : 'neutral zone (30-50)'}</li>
        <li>Volume increases by 20%+ from average</li>
    </ul>`);

    strategy.push(`<p>${baseExit}</p><ul>
        <li>Price reaches 1:2 risk/reward ratio</li>
        <li>${indicators.mainIndicator} shows reversal signs</li>
        <li>Hold maximum ${riskManagement[risk].maxHold} days</li>
    </ul>`);

    strategy.push(`<h4>Risk Management</h4><ul>
        <li>Stop Loss: ${riskManagement[risk].stopLoss} below entry</li>
        <li>Position Size: ${riskManagement[risk].positionSize}</li>
        <li>Trailing Stop: ${risk === 'high' ? '3% after 2% gain' : 'Not recommended'}</li>
    </ul>`);

    // Additional market context
    strategy.push(`<h4>Market Context</h4><ul>
        <li>Check sector performance (${days <= 5 ? '1-day' : '5-day'} trend)</li>
        <li>Monitor ${days >= 10 ? 'weekly' : 'daily'} economic calendar</li>
        <li>Watch ${indicators.volatilityMeasure} for volatility signals</li>
    </ul>`);

    return strategy.join('');
}