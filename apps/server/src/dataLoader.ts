import * as XLSX from 'xlsx'
import * as path from 'path'
import { AuctionPlayer, Role, Category } from './auctionPool'

export function loadPlayersFromExcel(): AuctionPlayer[] {
  const filePath = path.join(__dirname, 'IPL Players Dataset.xlsx')
  
  const workbook = XLSX.readFile(filePath)
  console.log('📋 Excel sheets found:', workbook.SheetNames)
  
  // Read Sheet1 for player info
  const sheet1Name = workbook.SheetNames[0]
  const sheet1 = workbook.Sheets[sheet1Name]
  const sheet1Data = XLSX.utils.sheet_to_json(sheet1) as any[]
  console.log(`📊 Sheet1 (${sheet1Name}): ${sheet1Data.length} players`)
  if (sheet1Data.length > 0) {
    console.log(`   Columns in Sheet1: ${Object.keys(sheet1Data[0]).join(', ')}`)
  }
  
  // Read Sheet2 for reserve prices (if it exists)
  let reservePriceMap: Record<string, number> = {}
  if (workbook.SheetNames.length > 1) {
    const sheet2Name = workbook.SheetNames[1]
    const sheet2 = workbook.Sheets[sheet2Name]
    const sheet2Data = XLSX.utils.sheet_to_json(sheet2) as any[]
    console.log(`💰 Sheet2 (${sheet2Name}): ${sheet2Data.length} entries`)
    if (sheet2Data.length > 0) {
      console.log(`   Columns in Sheet2: ${Object.keys(sheet2Data[0]).join(', ')}`)
    }
    
    // Create a map of player names to reserve prices
    sheet2Data.forEach((row: any) => {
      const firstName = row.FirstName || row['First Name'] || row['first_name'] || ''
      const lastName = row.LastName || row['Last Name'] || row['last_name'] || ''
      const fullName = `${firstName} ${lastName}`.trim()
      
      // Try multiple column name variations for reserve price
      let reservePrice = parseFloat(
        row['Reserve Price'] || 
        row['reserve price'] || 
        row['Reserve_Price'] || 
        row['Base Price'] || 
        row['BasePrice'] || 
        row['base_price'] || 
        0
      )
      
      // Convert from Lakhs to Crores (divide by 100)
      reservePrice = reservePrice / 100
      
      if (fullName) {
        reservePriceMap[fullName] = reservePrice
      }
    })
    console.log(`✅ Created reserve price map with ${Object.keys(reservePriceMap).length} entries`)
  }
  
  let id = 1
  const players: AuctionPlayer[] = sheet1Data.map((row: any, index: number) => {
    // Extract FirstName and LastName
    const firstName = row.FirstName || row['First Name'] || row['first_name'] || ''
    const lastName = row.LastName || row['Last Name'] || row['last_name'] || ''
    const fullName = `${firstName} ${lastName}`.trim()
    
    // Get rating from sheet1
    const rating = parseFloat(row.Rating || row['rating'] || 0)
    
    // Extract Specialism and map to Role
    const specialism = (row.Specialism || row['Specialism'] || row['specialism'] || '').toUpperCase()
    let role: Role = 'BAT'
    if (specialism.includes('BOWL')) role = 'BOWL'
    else if (specialism.includes('AR') || specialism.includes('ALL-ROUNDER')) role = 'AR'
    else if (specialism.includes('WICKET') || specialism.includes('WK')) role = 'WK'
    else if (specialism.includes('BAT')) role = 'BAT'
    
    // Assign category based on rating
    let category: Category = 'UNCAPPED'
    if (rating >= 9) category = 'MARQUEE'
    else if (rating >= 7) category = 'CAPPED'
    else category = 'UNCAPPED'
    
    // Get reserve price from Sheet2 map, or from Sheet1 as fallback
    let basePrice = reservePriceMap[fullName]
    if (!basePrice || basePrice === 0) {
      basePrice = parseFloat(
        row['Reserve Price'] || 
        row['reserve price'] || 
        row['Reserve_Price'] || 
        row['Base Price'] || 
        row['BasePrice'] || 
        row['base_price'] || 
        0
      )
    }
    
    // Convert from Lakhs to Crores (divide by 100)
    basePrice = basePrice / 100
    
    if (index < 3) {
      console.log(`   [${id}] "${fullName}" | Role: ${role} | Rating: ${rating} | Reserve: ₹${basePrice} Cr`)
    }
    
    return {
      id: String(id++),
      name: fullName,
      role,
      category,
      basePrice,
      rating
    }
  })
  
  console.log(`🎯 Total players loaded: ${players.length}`)
  if (players.length > 0) {
    console.log(`   Sample: ${players[0].name} (₹${players[0].basePrice} Cr, Rating: ${players[0].rating})`)
  }
  
  return players
}
