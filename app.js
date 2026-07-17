const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const employeesFilePath = path.join(__dirname, 'employees.json');

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to read employees from employees.json
function readEmployees() {
  try {
    const data = fs.readFileSync(employeesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading employees file:', error);
    return [];
  }
}

// Helper function to write employees to employees.json
function writeEmployees(employees) {
  try {
    fs.writeFileSync(employeesFilePath, JSON.stringify(employees, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing employees file:', error);
    return false;
  }
}

// Serve the index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * GET /api/employees
 * Return all employees from employees.json
 */
app.get('/api/employees', (req, res) => {
  try {
    const employees = readEmployees();
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve employees.' });
  }
});

/**
 * GET /api/employees/:id
 * Return a single employee by id
 */
app.get('/api/employees/:id', (req, res) => {
  try {
    const employees = readEmployees();
    const employee = employees.find(emp => emp.id === req.params.id);
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    
    res.status(200).json(employee);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error retrieving employee.' });
  }
});

/**
 * POST /api/employees
 * Add a new employee with validation
 */
app.post('/api/employees', (req, res) => {
  try {
    const { name, department, designation, email, phone, status } = req.body;
    
    // Validation
    if (!name || !department || !designation || !email || !phone || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields (name, department, designation, email, phone, status) are required.' 
      });
    }

    const employees = readEmployees();
    
    // Generate new EMP ID automatically
    const maxId = employees.reduce((max, emp) => {
      const num = parseInt(emp.id.replace('EMP-', ''), 10);
      return isNaN(num) ? max : (num > max ? num : max);
    }, 0);
    const newId = `EMP-${String(maxId + 1).padStart(3, '0')}`;

    // Get initials for avatar
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    const newEmployee = {
      id: newId,
      name,
      department,
      designation,
      email,
      phone,
      status,
      avatar: initials || 'EE'
    };

    employees.push(newEmployee);
    
    if (writeEmployees(employees)) {
      res.status(201).json(newEmployee);
    } else {
      res.status(500).json({ success: false, message: 'Failed to write data.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error creating employee.' });
  }
});

/**
 * PUT /api/employees/:id
 * Update only the provided fields of an existing employee
 */
app.put('/api/employees/:id', (req, res) => {
  try {
    const employees = readEmployees();
    const employeeIndex = employees.findIndex(emp => emp.id === req.params.id);
    
    if (employeeIndex === -1) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const currentEmployee = employees[employeeIndex];
    const updates = req.body;

    // Validate updated fields if they are provided
    const fieldsToValidate = ['name', 'department', 'designation', 'email', 'phone', 'status'];
    for (const field of fieldsToValidate) {
      if (updates.hasOwnProperty(field) && (updates[field] === undefined || updates[field] === null || updates[field].toString().trim() === '')) {
        return res.status(400).json({ success: false, message: `${field} cannot be empty.` });
      }
    }

    // Merge updates
    const updatedEmployee = {
      ...currentEmployee,
      ...updates,
      id: currentEmployee.id // Ensure ID remains immutable
    };

    // Update initials if name changed
    if (updates.name) {
      updatedEmployee.avatar = updates.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }

    employees[employeeIndex] = updatedEmployee;

    if (writeEmployees(employees)) {
      res.status(200).json(updatedEmployee);
    } else {
      res.status(500).json({ success: false, message: 'Failed to write data.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error updating employee.' });
  }
});

/**
 * DELETE /api/employees/:id
 * Delete employee by id
 */
app.delete('/api/employees/:id', (req, res) => {
  try {
    const employees = readEmployees();
    const employeeIndex = employees.findIndex(emp => emp.id === req.params.id);
    
    if (employeeIndex === -1) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    employees.splice(employeeIndex, 1);

    if (writeEmployees(employees)) {
      res.status(200).json({ success: true, message: 'Employee deleted successfully.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to write data.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error deleting employee.' });
  }
});

// Dynamic port listener with EADDRINUSE handling
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`==================================================`);
    console.log(`Employee Directory Server running on port ${port}`);
    console.log(`URL: http://localhost:${port}`);
    console.log(`==================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      throw err;
    }
  });
}

startServer(PORT);

