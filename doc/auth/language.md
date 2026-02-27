import React, { createContext, useState, useContext } from 'react';
import { lang } from '../language'; 

const LanguageContext = createContext();
    
export const useLanguage = () =>  useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('am'); 

    const toggleLanguage = (selectedLanguage) => {
        setLanguage(selectedLanguage);
    };
    
    const translate = (word) => {
        return lang[language][word] || word; 
    };

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, translate }}>
            {children}
        </LanguageContext.Provider>
    );
};


<Provider store={store}>
        <LanguageProvider>
          <PersistGate loading={null} persistor={persist}>
            <ThemeProvider theme={theme}>
              {/* Display the routing only when Keycloak is initialized */}
              <Routing />
            </ThemeProvider>
          </PersistGate>
        </LanguageProvider>
      </Provider>
    </ReactKeycloakProvider>

    import axiosInstance from '@/config/axios';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from "../../../LanguageProvider";
import '../../MangerPage/pages/TaskAssignee.css'; // Custom CSS file for styling



const ApprovalPage = ({ id }) => {
  const [users, setUsers] = useState([]);
  const location = useLocation();
  const pathSegments = location.pathname.split('/');
  const branchId = pathSegments[pathSegments.length - 1];
  const [userTasks, setUserTasks] = useState({}); // Store the state of tasks for each user
  const { translate } = useLanguage();


  // Fetch users and their task statuses from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axiosInstance.get(`api/planPermissions/1/50`); // API call to fetch users and task statuses
        const usersData = response.data.content;
        // console.log("user data" , usersData)

        // Initialize the user tasks based on the API response
        const initialTasks = {};
        usersData.forEach(user => {
          initialTasks[user.userId] = {
            canApprove: user.canApprove,
            canAdjust: user.canAdjust,
            id: user.id
          };
        });

        setUsers(usersData);
        setUserTasks(initialTasks); // Set initial task states
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  // Handle checkbox change
  const handleCheckboxChange = (userId, task, isChecked) => {
    // Update the user task state for the checked task
    setUserTasks(prevTasks => ({
      ...prevTasks,
      [userId]: {
        ...prevTasks[userId],
        [task]: isChecked,
      },
    }));

    // Prepare payload to send to API

  };


  const handleSaveChanges = () => {

    // Send the updated data in a single API request
    const updatedPermissions = users.map(user => ({
      userDto: {
        id: user.userId,
      },
      canAdjust: userTasks[user.userId]?.canAdjust,
      canApprove: userTasks[user.userId]?.canApprove,
      permissionId: userTasks[user.userId].id,
      okrDepartmentId: parseInt(branchId),
      pageNumber: 1,
      totalPages: 10,
    }));;

    // Send the data to API
    // console.log("update permission" , updatedPermissions)
    const data = {

      permissions: [...updatedPermissions],
      totalelement: 0,
      pageNumber: 1,
      totalPages: 10

    }
    // console.log("data" , data)

    axiosInstance.post('api/planPermissions',
      data
    )
      .then(response => {
        // console.log('Task update successful:', response.data);
        alert("Permisison update successful")
      })
      .catch(error => {
        console.error('Error updating task:', error);
      });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5; // Adjust the number of users per page

  // Calculate pagination
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  return (
    <div className="task-assignee-container">
      <h1 className="title">{translate("Permission Management Approval")} </h1>

      {/* Table of Users and Tasks */}
      <div className="table-wrapper">
        <table className="task-table">
          <thead>
            <tr>
              <th>{translate("Users")}</th>
              <th>{translate("Can Adjust")}</th>
              <th>{translate("Can Approve")}</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map(user => (
              <tr key={user.userId}>
                <td>{user.name}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={userTasks[user.userId]?.canAdjust || false}
                    onChange={(e) =>
                      handleCheckboxChange(user.userId, 'canAdjust', e.target.checked)
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={userTasks[user.userId]?.canApprove || false}
                    onChange={(e) =>
                      handleCheckboxChange(user.userId, 'canApprove', e.target.checked)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="pagination-controls">
        <button
          className="pagination-button"
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          ◀ Previous
        </button>

        <span className="pagination-text">
          Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
        </span>

        <button
          className="pagination-button"
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next ▶
        </button>
      </div>

      {/* Save Button */}
      <div className="save-button-wrapper">
        <button
          style={{ backgroundColor: 'blue', borderRadius: 10, padding: 10, color: 'white' }}
          onClick={handleSaveChanges}
        >
          {translate("Save Changes")}
        </button>
      </div>
    </div>
  );
};

export default ApprovalPage;
