import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import Templates from "./pages/Templates";
import Inbox from "./pages/Inbox";
import Reports from "./pages/Reports";
import WhatsAppSetup from "./pages/WhatsAppSetup";
import MessageFlows from "./pages/MessageFlows";

import ProtectedRoute from "./utils/ProtectedRoute";
import MainLayout from "./layouts/MainLayout";

function App(){

  return(

    <BrowserRouter>

      <Routes>

        <Route path="/" element={<Login/>}/>
        <Route path="/signup" element={<Signup/>}/>

        <Route
          element={
            <ProtectedRoute>
              <MainLayout/>
            </ProtectedRoute>
          }
        >

          <Route path="/dashboard" element={<Dashboard/>}/>
          <Route path="/contacts" element={<Contacts/>}/>
          <Route path="/campaigns" element={<Campaigns/>}/>
          <Route path="/templates" element={<Templates/>}/>
          <Route path="/inbox" element={<Inbox/>}/>
          <Route path="/reports" element={<Reports/>}/>
          <Route path="/message-flows" element={<MessageFlows/>}/>
          <Route path="/whatsapp-setup" element={<WhatsAppSetup/>}/>

        </Route>

      </Routes>

    </BrowserRouter>

  );

}

export default App;
