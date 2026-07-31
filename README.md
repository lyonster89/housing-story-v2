# Housing Pressure Narrative Visualization

This project is a four-scene interactive D3 visualization examining whether housing supply has kept up with household growth and how mortgage rates affect affordability.

## Project structure

```text
housing-pressure-visualization/
├── index.html
├── style.css
├── script.js
├── README.md
└── data/
    └── processed/
        └── housing_pressure_last_10_years.json
```

## Scenes

### Scene 1: Household growth versus new housing

This scene compares:

- New households formed each year
- Newly completed housing units
- The annual difference between housing completions and new households

The calculation is:

```text
annual housing gap =
housing completions - new households
```

A positive value means completions exceeded household growth. A negative value means household growth exceeded completions.

### Scene 2: Mortgage-rate effects

This scene shows:

- Average 30-year mortgage APR for each year
- Monthly principal-and-interest payment on a $200,000 mortgage
- A comparison between the lowest and highest calculated payment

The mortgage uses:

- Loan amount: $200,000
- Loan term: 30 years
- Number of monthly payments: 360
- Annual mortgage rate from the dataset

Taxes, homeowners insurance, mortgage insurance, and association fees are not included.

### Scene 3: Income growth versus mortgage-payment growth

This scene compares:

- Annual median household-income growth
- Annual growth in the payment on the fixed $200,000 mortgage

Income data currently ends in 2024, so this comparison does not include 2025.

### Scene 4: Interactive comparison

Users can select:

- Total households
- New households
- Median household income
- Mortgage APR
- Monthly payment on a $200,000 mortgage
- Annual mortgage payment as a percentage of median household income

Because these variables use different units, each selected measure is indexed to 100 in its first available year.

## How the JavaScript is organized

`script.js` follows this sequence:

1. Load the JSON file.
2. Validate the required fields.
3. Calculate derived variables.
4. Draw all four scenes.
5. Redraw the charts when the browser is resized.

Important calculated fields include:

```text
new households =
current total households - previous total households
```

```text
housing gap =
housing completions - new households
```

```text
annual mortgage cost =
monthly mortgage payment * 12
```

```text
mortgage cost as a percentage of income =
annual mortgage cost / median household income * 100
```

## Important limitations

- Housing completions are used as a national approximation of new housing becoming available.
- Completed housing is not necessarily located where household demand is strongest.
- Mortgage payments represent principal and interest only.
- The fixed $200,000 loan isolates interest-rate effects and does not represent changes in home prices.
- National figures do not describe every local housing market.


# References

## Data Sources

Federal Reserve Bank of St. Louis. (2025). *30-Year Fixed Rate Mortgage Average in the United States (MORTGAGE30US).* Federal Reserve Economic Data (FRED). https://fred.stlouisfed.org/series/MORTGAGE30US

Federal Reserve Bank of St. Louis. (2025). *Median Sales Price of Houses Sold for the United States (MSPUS).* Federal Reserve Economic Data (FRED). https://fred.stlouisfed.org/series/MSPUS

Federal Reserve Bank of St. Louis. (2025). *Median Household Income in the United States (MEHOINUSA646N).* Federal Reserve Economic Data (FRED). https://fred.stlouisfed.org/series/MEHOINUSA646N

Federal Reserve Bank of St. Louis. (2025). *Total Households (TTLHH).* Federal Reserve Economic Data (FRED). https://fred.stlouisfed.org/series/TTLHH

Federal Reserve Bank of St. Louis. (2025). *Total Housing Units (ETOTALUSQ176N).* Federal Reserve Economic Data (FRED). https://fred.stlouisfed.org/series/ETOTALUSQ176N

United States Census Bureau. (2025). *New Residential Construction.* https://www.census.gov/construction/nrc/

United States Census Bureau. (2024). *American Community Survey Table B25004: Vacancy Status.* https://data.census.gov/

Zillow Research. (2025). *Zillow Observed Rent Index (ZORI).* https://www.zillow.com/research/data/

---

## Software Libraries

Bostock, M. (2025). *D3.js: Data-Driven Documents.* https://d3js.org/

The Pandas Development Team. (2025). *pandas.* https://pandas.pydata.org/

Python Software Foundation. (2025). *Python 3.* https://www.python.org/

OpenPyXL Developers. (2025). *openpyxl.* https://openpyxl.readthedocs.io/

---