function doGet(e) {
  var sheetConfig = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuracion");
  var sheetPersonas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Personas");

  var params = e.parameter || {};

  try {
    // Get configuration
    var numEquipos = sheetConfig.getRange("B2").getValue();
    var coloresRaw = sheetConfig.getRange("B3").getValue();
    var colores = String(coloresRaw).split(",").map(c => c.trim()).filter(c => c.length > 0);

    if (params.action == "getConfig") {
      return ContentService.createTextOutput(JSON.stringify({
        num_equipos: numEquipos,
        colores: colores
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action == "getPersonas") {
      var data = sheetPersonas.getDataRange().getValues();
      var personas = [];
      for (var i = 1; i < data.length; i++) {
        personas.push({
          id: data[i][0],
          nombre: data[i][1],
          color: data[i][2]
        });
      }
      return ContentService.createTextOutput(JSON.stringify(personas))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action == "getPersona") {
      var id = params.id;
      if (!id) {
        return ContentService.createTextOutput(JSON.stringify({error: "Falta ID"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var data = sheetPersonas.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
          return ContentService.createTextOutput(JSON.stringify({
            id: data[i][0],
            nombre: data[i][1],
            color: data[i][2]
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({error: "Persona no encontrada"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action == "assignColor") {
      var id = params.id;
      var nombre = params.nombre || "";
      
      if (!id) {
        return ContentService.createTextOutput(JSON.stringify({error: "Falta ID"}))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Check if person already exists
      var data = sheetPersonas.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
          return ContentService.createTextOutput(JSON.stringify({
            id: data[i][0],
            nombre: data[i][1],
            color: data[i][2]
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // Assign new color using round-robin
      var assignedColor = getNextColor(colores, numEquipos);
      
      // Add new person
      sheetPersonas.appendRow([id, nombre, assignedColor]);
      
      return ContentService.createTextOutput(JSON.stringify({
        id: id,
        nombre: nombre,
        color: assignedColor
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action == "addPersona") {
      var id = params.id;
      var nombre = params.nombre || "";
      var color = params.color;
      if (!id || !color) {
        return ContentService.createTextOutput(JSON.stringify({error: "Falta id o color"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      sheetPersonas.appendRow([id, nombre, color]);
      return ContentService.createTextOutput(JSON.stringify({status: "ok"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({error: "Accion no valida"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getNextColor(colores, numEquipos) {
  var sheetPersonas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Personas");
  var data = sheetPersonas.getDataRange().getValues();
  
  // Count people per team
  var teamCounts = {};
  var availableColors = colores.slice(0, numEquipos);
  
  // Initialize counts
  for (var i = 0; i < availableColors.length; i++) {
    teamCounts[availableColors[i]] = 0;
  }
  
  // Count existing assignments
  for (var i = 1; i < data.length; i++) {
    var color = data[i][2];
    if (teamCounts.hasOwnProperty(color)) {
      teamCounts[color]++;
    }
  }
  
  // Find team with minimum count
  var minCount = Math.min.apply(null, Object.values(teamCounts));
  var availableTeams = [];
  
  for (var color in teamCounts) {
    if (teamCounts[color] === minCount) {
      availableTeams.push(color);
    }
  }
  
  // Return random color from teams with minimum count
  var randomIndex = Math.floor(Math.random() * availableTeams.length);
  return availableTeams[randomIndex];
}

function redistribuirEquipos() {
  var sheetConfig = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuracion");
  var sheetPersonas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Personas");

  var numEquipos = sheetConfig.getRange("B2").getValue();
  var coloresRaw = sheetConfig.getRange("B3").getValue();
  var colores = String(coloresRaw).split(",").map(c => c.trim()).filter(c => c.length > 0);

  if (numEquipos > colores.length) {
    throw new Error("Hay menos colores que equipos. Ajusta la hoja de Configuracion.");
  }

  colores = colores.slice(0, numEquipos);

  var data = sheetPersonas.getDataRange().getValues();
  if (data.length <= 1) return; // No hay personas

  var personas = data.slice(1);

  // Barajar Fisher-Yates
  for (let i = personas.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [personas[i], personas[j]] = [personas[j], personas[i]];
  }

  // Reasignar
  let colorIndex = 0;
  for (let i = 0; i < personas.length; i++) {
    personas[i][2] = colores[colorIndex];
    colorIndex = (colorIndex + 1) % numEquipos;
  }

  sheetPersonas.getRange(2, 1, personas.length, personas[0].length).setValues(personas);
}